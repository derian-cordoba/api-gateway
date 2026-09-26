import { StatusCodes } from "http-status-codes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import express from "express";
import supertest from "supertest";
import { RouteStorageManager } from "../../src/modules/route-configuration/infrastructure/RouteStorageManager";
import { StorageDriver } from "../../src/modules/route-configuration/infrastructure/config/storage-config";
import { createRevision } from "../../src/modules/route-configuration/domain/revision";
import { RouteReloader } from "../../src/apps/api-gateway/routes/RouteReloader";

describe("database-driven gateway reload", () => {
  let directory: string;
  let manager: RouteStorageManager;
  let reloader: RouteReloader;
  let upstream: Server;
  let target: string;
  const state = vi.fn();

  beforeEach(async () => {
    vi.stubEnv("ROUTES", "[]");
    state.mockClear();
    directory = await mkdtemp(join(tmpdir(), "gateway-database-reload-"));
    manager = new RouteStorageManager({
      driver: StorageDriver.SQLite,
      path: join(directory, "routes.sqlite"),
      busyTimeoutMs: 1000,
      configurationKey: "test",
      historyLimit: 50,
      pollIntervalMs: 100,
    });
    await manager.migrate();
    upstream = createServer((_req, res) => {
      res.end("upstream-ok");
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, "127.0.0.1", resolve),
    );
    const address = upstream.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test port");
    target = `http://127.0.0.1:${address.port}`;
    reloader = new RouteReloader(
      undefined,
      undefined,
      { routeStorageManager: manager },
      undefined,
      state,
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await reloader.stop();
    await manager.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("fails startup on an uninitialized database", async () => {
    await expect(reloader.start()).rejects.toMatchObject({
      code: "uninitialized",
    });
  });

  it("reloads saves and restores, retains last good routes during outages, and recovers", async () => {
    const repo = await manager.getRepository();
    await repo.initialize(
      [createRevision([{ baseURL: "/old", proxy: { target } }])],
      "seed",
    );
    await reloader.start();
    const app = express();
    app.use(reloader.getDelegatorMiddleware());
    const request = supertest(app);
    expect((await request.get("/old")).text).toBe("upstream-ok");
    const service = await manager.getService();
    const original = await service.read();
    const saved = await service.write(
      [{ baseURL: "/new", proxy: { target } }],
      original.revision,
    );
    await vi.waitFor(() =>
      expect(state).toHaveBeenLastCalledWith({
        status: "synchronized",
        revision: saved.revision,
      }),
    );
    expect((await request.get("/new")).text).toBe("upstream-ok");
    expect((await request.get("/old")).status).toBe(StatusCodes.NOT_FOUND);

    const head = vi.spyOn(repo, "head").mockRejectedValue(new Error("offline"));
    await vi.waitFor(() =>
      expect(state).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "degraded" }),
      ),
    );
    expect((await request.get("/new")).text).toBe("upstream-ok");
    head.mockRestore();
    const restored = await service.restore(original.revision, saved.revision);
    await vi.waitFor(() =>
      expect(state).toHaveBeenLastCalledWith({
        status: "synchronized",
        revision: restored.revision,
      }),
    );
    expect((await request.get("/old")).text).toBe("upstream-ok");
  });
});
