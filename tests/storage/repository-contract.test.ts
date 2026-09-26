import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { RouteStorageManager } from "../../src/modules/route-configuration/infrastructure/RouteStorageManager";
import {
  StorageDriver,
  DatabaseEnvironment,
  type StorageConfig,
} from "../../src/modules/route-configuration/infrastructure/config/storage-config";
import { createRevision } from "../../src/modules/route-configuration/domain/revision";
import { ConfigurationConflictError } from "../../src/modules/route-configuration/domain/errors";

const routes = [
  { baseURL: "/orders", proxy: { target: "http://localhost:4100" } },
];

for (const driver of Object.values(StorageDriver)) {
  const enabled =
    driver === StorageDriver.SQLite ||
    (driver === StorageDriver.PostgreSQL
      ? !!process.env.TEST_POSTGRES_URL
      : !!process.env.TEST_MONGODB_URI);
  describe.skipIf(!enabled)(`route repository contract: ${driver}`, () => {
    let directory: string;
    let config: StorageConfig;
    let manager: RouteStorageManager;
    const managers: RouteStorageManager[] = [];
    beforeEach(async () => {
      directory = await mkdtemp(join(tmpdir(), "route-storage-"));
      const common = {
        configurationKey: randomUUID(),
        historyLimit: 2,
        pollIntervalMs: 100,
      };
      config =
        driver === StorageDriver.SQLite
          ? {
              ...common,
              driver,
              path: join(directory, "routes.sqlite"),
              busyTimeoutMs: 1000,
            }
          : driver === StorageDriver.PostgreSQL
            ? {
                ...common,
                driver,
                environment: DatabaseEnvironment.Development,
                url: process.env.TEST_POSTGRES_URL!,
                poolSize: 2,
              }
            : {
                ...common,
                driver,
                environment: DatabaseEnvironment.Development,
                uri: process.env.TEST_MONGODB_URI!,
                database: "route_storage_test",
                poolSize: 2,
              };
      manager = new RouteStorageManager(config);
      managers.push(manager);
      await manager.migrate();
      await manager.migrate();
    });
    afterEach(async () => {
      await Promise.all(managers.splice(0).map((m) => m.close()));
      await rm(directory, { recursive: true, force: true });
    });

    it("requires explicit initialization and keeps initialization idempotent", async () => {
      const service = await manager.getService();
      await expect(service.read()).rejects.toMatchObject({
        code: "uninitialized",
      });
      const repository = await manager.getRepository();
      const first = createRevision(routes);
      await repository.initialize([first], "import-1");
      await repository.initialize([createRevision([])], "import-1");
      expect((await service.read()).revision).toBe(first.revision);
      await expect(
        repository.initialize([createRevision([])], "different"),
      ).rejects.toMatchObject({ code: "configuration" });
    });

    it("persists across connections and creates a new revision on restore", async () => {
      const repo = await manager.getRepository();
      await repo.initialize([createRevision(routes)], "seed");
      const service = await manager.getService();
      const first = await service.read();
      const saved = await service.write([], first.revision);
      const restored = await service.restore(first.revision, saved.revision);
      expect(restored.routes).toEqual(routes);
      expect(restored.revision).not.toBe(first.revision);
      expect((await service.listHistory()).map((r) => r.revision)).toEqual([
        saved.revision,
        first.revision,
      ]);
      const second = new RouteStorageManager(config);
      managers.push(second);
      expect(await (await second.getService()).read()).toEqual(restored);
    });

    it("allows exactly one concurrent writer with the same precondition", async () => {
      const repo = await manager.getRepository();
      await repo.initialize([createRevision(routes)], "seed");
      const second = new RouteStorageManager(config);
      managers.push(second);
      const firstService = await manager.getService();
      const otherService = await second.getService();
      const revision = (await firstService.read()).revision;
      const results = await Promise.allSettled([
        firstService.write([], revision),
        otherService.write(routes, revision),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(ConfigurationConflictError);
      expect(await repo.history(10, 0)).toHaveLength(1);
    });

    it("rolls back the head and history on a failed commit", async () => {
      const repo = await manager.getRepository();
      const initial = createRevision(routes);
      await repo.initialize([initial], "seed");
      await expect(
        repo.commit(
          { ...createRevision([]), revision: initial.revision },
          initial.revision,
          2,
        ),
      ).rejects.toBeDefined();
      expect(await repo.head()).toBe(initial.revision);
      expect(await repo.history(10, 0)).toEqual([]);
    });

    it("retains exactly the configured history and supports pagination", async () => {
      await (
        await manager.getRepository()
      ).initialize([createRevision(routes)], "seed");
      const service = await manager.getService();
      let current = await service.read();
      const original = current.revision;
      for (let i = 0; i < 4; i++)
        current = await service.write(routes, current.revision);
      const history = await service.listHistory();
      expect(history).toHaveLength(2);
      expect(history.map((h) => h.version)).toEqual([4, 3]);
      expect(await service.listHistory(1, 1)).toEqual([history[1]]);
      await expect(
        service.restore(original, current.revision),
      ).rejects.toMatchObject({ code: "not-found" });
    });

    it("rejects invalid routes and missing preconditions without changes", async () => {
      const repo = await manager.getRepository();
      await repo.initialize([createRevision(routes)], "seed");
      const service = await manager.getService();
      const first = await service.read();
      await expect(service.write([])).rejects.toMatchObject({
        code: "precondition",
      });
      await expect(
        service.write(
          [{ baseURL: "invalid", proxy: { target: "invalid" } }],
          first.revision,
        ),
      ).rejects.toMatchObject({ code: "configuration" });
      expect(await repo.head()).toBe(first.revision);
    });

    it("isolates configuration keys in a shared database", async () => {
      await (
        await manager.getRepository()
      ).initialize([createRevision(routes)], "seed");
      const second = new RouteStorageManager({
        ...config,
        configurationKey: randomUUID(),
      });
      managers.push(second);
      expect(await (await second.getRepository()).head()).toBeNull();
    });

    it("handles concurrent initialization without duplicate heads or history", async () => {
      const second = new RouteStorageManager(config);
      managers.push(second);
      const firstRepo = await manager.getRepository();
      const secondRepo = await second.getRepository();
      const snapshot = createRevision(routes);
      await Promise.all([
        firstRepo.initialize([snapshot], "same-seed"),
        secondRepo.initialize([snapshot], "same-seed"),
      ]);
      expect(await firstRepo.head()).toBe(snapshot.revision);
      expect(await firstRepo.history(10, 0)).toEqual([]);
    });

    it("enforces the same write precondition across separate processes", async () => {
      const repo = await manager.getRepository();
      const snapshot = createRevision(routes);
      await repo.initialize([snapshot], "seed");
      const children = [0, 1].map(() =>
        fork(
          fileURLToPath(new URL("./concurrent-writer.cjs", import.meta.url)),
          [],
          { stdio: ["ignore", "ignore", "inherit", "ipc"] },
        ),
      );
      try {
        const ready = children.map(
          (child) =>
            new Promise<void>((resolve, reject) => {
              child.once("error", reject);
              child.once(
                "message",
                (message: { ready?: boolean; message?: string }) =>
                  message.ready
                    ? resolve()
                    : reject(new Error(message.message)),
              );
              child.send({ config, expectedRevision: snapshot.revision });
            }),
        );
        await Promise.all(ready);
        const results = children.map(
          (child) =>
            new Promise<string>((resolve, reject) => {
              child.once("error", reject);
              child.once("message", (message: { outcome: string }) =>
                resolve(message.outcome),
              );
              child.send({ start: true });
            }),
        );
        expect((await Promise.all(results)).sort()).toEqual([
          "conflict",
          "saved",
        ]);
        expect(await repo.history(10, 0)).toHaveLength(1);
      } finally {
        await Promise.all(
          children.map(
            (child) =>
              new Promise<void>((resolve) => {
                if (child.exitCode !== null || child.signalCode !== null)
                  return resolve();
                const timer = setTimeout(() => child.kill(), 2000);
                child.once("exit", () => {
                  clearTimeout(timer);
                  resolve();
                });
              }),
          ),
        );
      }
    }, 15000);
  });
}
