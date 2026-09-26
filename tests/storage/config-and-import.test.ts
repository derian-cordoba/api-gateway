import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readStorageConfig } from "../../src/modules/route-configuration/infrastructure/config/storage-config";
import { JsonConfigurationImporter } from "../../src/modules/route-configuration/infrastructure/legacy/JsonConfigurationImporter";

describe("route storage configuration and import", () => {
  it("selects profiles explicitly independently of NODE_ENV", () => {
    const config = readStorageConfig({
      ROUTE_STORAGE_DRIVER: "postgres",
      ROUTE_DATABASE_ENV: "development",
      NODE_ENV: "production",
      ROUTE_POSTGRES_DEVELOPMENT_URL: "postgresql://localhost/development",
    });
    expect(config).toMatchObject({
      environment: "development",
      url: "postgresql://localhost/development",
    });
    expect(() =>
      readStorageConfig({
        ROUTE_STORAGE_DRIVER: "postgres",
        ROUTE_DATABASE_ENV: "production",
        ROUTE_POSTGRES_DEVELOPMENT_URL: "postgresql://localhost/development",
      }),
    ).toThrow("ROUTE_POSTGRES_PRODUCTION_URL");
  });
  it("does not apply remote profiles to SQLite and rejects ambiguous paths", () => {
    const config = readStorageConfig({
      ROUTE_STORAGE_DRIVER: "sqlite",
      ROUTE_SQLITE_PATH: "/tmp/routes.sqlite",
      ROUTE_DATABASE_ENV: "production",
    });
    expect(config).not.toHaveProperty("environment");
    expect(() =>
      readStorageConfig({
        ROUTE_STORAGE_DRIVER: "sqlite",
        ROUTE_SQLITE_PATH: "routes.sqlite",
      }),
    ).toThrow("absolute");
    expect(() =>
      readStorageConfig({ ROUTE_STORAGE_DRIVER: "unknown" }),
    ).toThrow("ROUTE_STORAGE_DRIVER");
  });
  it("imports current state last and computes stable import receipts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "route-import-"));
    try {
      const file = join(directory, "routes.json");
      await mkdir(`${file}.history`);
      await writeFile(file, "[]\n");
      await writeFile(
        join(`${file}.history`, "1234567890abcdef.json"),
        JSON.stringify([
          { baseURL: "/old", proxy: { target: "http://localhost:4100" } },
        ]),
      );
      const importer = new JsonConfigurationImporter();
      const result = await importer.prepare(file);
      expect(result.revisions).toHaveLength(2);
      expect(result.revisions[0].legacyRevision).toBe("1234567890abcdef");
      expect(result.revisions[1].routes).toEqual([]);
      expect((await importer.prepare(file)).importId).toBe(result.importId);
      await writeFile(join(`${file}.history`, "1234567890abcdef.json"), "{}");
      await expect(importer.prepare(file)).rejects.toThrow("Invalid routes");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
