import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RouteStorageManager } from "../../src/modules/route-configuration/infrastructure/RouteStorageManager";
import { readStorageConfig } from "../../src/modules/route-configuration/infrastructure/config/storage-config";
import { createRevision } from "../../src/modules/route-configuration/domain/revision";

// Deliberately independent of ORM metadata: represents the schema shipped by the original adapter.
const legacySchema = `
CREATE TABLE route_storage_schema (id INTEGER PRIMARY KEY, version INTEGER NOT NULL, checksum TEXT NOT NULL);
INSERT INTO route_storage_schema VALUES (1, 1, '382c8771af5c4113f634b10e44e48c12220fd1e6537121b8eecc04d7b8729ed7');
CREATE TABLE route_heads (config_key TEXT PRIMARY KEY, revision TEXT NOT NULL, version BIGINT NOT NULL);
CREATE TABLE route_revisions (config_key TEXT NOT NULL, revision TEXT NOT NULL, version BIGINT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL, checksum TEXT NOT NULL, restored_from TEXT, legacy_revision TEXT, PRIMARY KEY (config_key, revision), UNIQUE (config_key, version));
CREATE TABLE route_imports (config_key TEXT NOT NULL, import_id TEXT NOT NULL, PRIMARY KEY (config_key, import_id));
`;

describe("TypeORM compatibility with existing storage", () => {
  let manager: RouteStorageManager | undefined;
  let directory: string;
  afterEach(async () => {
    await manager?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  async function fixture(checksumValid = true) {
    directory = await mkdtemp(join(tmpdir(), "route-orm-"));
    const path = join(directory, "routes.sqlite");
    const db = new Database(path);
    const revision = {
      ...createRevision([]),
      version: 1,
      legacyRevision: "1234567890abcdef",
    };
    try {
      db.exec(legacySchema);
      db.prepare("INSERT INTO route_heads VALUES (?, ?, ?)").run(
        "default",
        revision.revision,
        1,
      );
      db.prepare(
        "INSERT INTO route_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        "default",
        revision.revision,
        1,
        "[]",
        revision.updatedAt,
        revision.checksum,
        null,
        revision.legacyRevision,
      );
      if (!checksumValid)
        db.prepare("UPDATE route_storage_schema SET checksum = ?").run(
          "unsupported",
        );
    } finally {
      db.close();
    }
    manager = new RouteStorageManager(
      readStorageConfig({
        ROUTE_STORAGE_DRIVER: "sqlite",
        ROUTE_SQLITE_PATH: path,
      }),
    );
    return revision;
  }

  it("opens legacy data before migration and preserves it through migration and writes", async () => {
    const original = await fixture();
    const repository = await manager!.getRepository();
    expect(await repository.read()).toEqual(original);
    await manager!.migrate();
    expect(await repository.read()).toEqual(original);
    const saved = await repository.commit(
      createRevision([]),
      original.revision,
      50,
    );
    expect(saved.version).toBe(2);
    expect(await repository.find(original.revision)).toEqual(original);
    expect(await repository.history(50, 0)).toEqual([
      {
        revision: original.revision,
        version: 1,
        updatedAt: original.updatedAt,
      },
    ]);
  });

  it("serializes concurrent SQLite schema bootstrap without a partial migration", async () => {
    directory = await mkdtemp(join(tmpdir(), "route-orm-bootstrap-"));
    const config = readStorageConfig({
      ROUTE_STORAGE_DRIVER: "sqlite",
      ROUTE_SQLITE_PATH: join(directory, "routes.sqlite"),
    });
    manager = new RouteStorageManager(config);
    const other = new RouteStorageManager(config);
    try {
      await Promise.all([manager.migrate(), other.migrate()]);
      const repository = await manager.getRepository();
      const revision = createRevision([]);
      await repository.initialize([revision], "seed");
      expect(await (await other.getRepository()).head()).toBe(
        revision.revision,
      );
    } finally {
      await other.close();
    }
  });

  it("rejects incompatible schemas without silently synchronizing them", async () => {
    await fixture(false);
    await expect(manager!.getRepository()).rejects.toMatchObject({
      code: "schema",
    });
    await expect(manager!.migrate()).rejects.toMatchObject({ code: "schema" });
  });
});
