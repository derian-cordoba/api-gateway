/**
 * Integration test for hot config reload.
 *
 * Strategy: instantiate RouteReloader directly with a real temp routes file
 * and two live upstream servers.  After the initial load we overwrite the
 * routes file and send SIGHUP; after the reload settles we verify the
 * delegator middleware forwards to the new upstream.
 *
 * Port allocation: 19_040 (upstream A) · 19_041 (upstream B)
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import { writeFile, unlink } from "node:fs/promises";
import express from "express";
import supertest from "supertest";

// ── TEMP_ROUTES_FILE must be determined before vi.mock hoisting ──────────────

const { TEMP_ROUTES_FILE } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir } = require("node:os") as typeof import("node:os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require("node:path") as typeof import("node:path");
  return { TEMP_ROUTES_FILE: join(tmpdir(), `gateway-hot-reload-${process.pid}.json`) };
});

vi.mock("../../src/apps/api-gateway/config/app-env", () => ({
  appEnv: { routes: { filePath: TEMP_ROUTES_FILE } },
}));

vi.mock("../../src/apps/api-gateway/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { RouteReloader } from "../../src/apps/api-gateway/routes/RouteReloader";

// ── Constants ─────────────────────────────────────────────────────────────────

const PORT_A = 19_040;
const PORT_B = 19_041;

// ── Helpers ───────────────────────────────────────────────────────────────────

function startUpstream(port: number, instance: string): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ instance, port }));
    });
    server.listen(port, () => resolve(server));
  });
}

function makeRoutes(port: number): string {
  return JSON.stringify([
    {
      baseURL: "/api",
      proxy: {
        target: `http://localhost:${port}`,
        changeOrigin: true,
        pathRewrite: { "^/api": "" },
      },
    },
  ]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Hot config reload", () => {
  let upstreamA: HttpServer;
  let upstreamB: HttpServer;
  let reloader: RouteReloader;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    [upstreamA, upstreamB] = await Promise.all([
      startUpstream(PORT_A, "A"),
      startUpstream(PORT_B, "B"),
    ]);

    // Write initial routes file pointing to upstream A
    await writeFile(TEMP_ROUTES_FILE, makeRoutes(PORT_A), "utf-8");

    reloader = new RouteReloader();
    await reloader.start();

    const app = express();
    app.use(reloader.getDelegatorMiddleware());
    request = supertest(app);
  });

  afterAll(async () => {
    reloader.stop();
    process.removeAllListeners("SIGHUP");
    await Promise.all([
      new Promise<void>((resolve) => upstreamA.close(() => resolve())),
      new Promise<void>((resolve) => upstreamB.close(() => resolve())),
      unlink(TEMP_ROUTES_FILE).catch(() => undefined),
    ]);
  });

  it("routes requests to upstream A on initial load", async () => {
    const res = await request.get("/api");
    expect(res.status).toBe(200);
    expect(res.body.instance).toBe("A");
  });

  it("routes requests to upstream B after SIGHUP reload", async () => {
    await writeFile(TEMP_ROUTES_FILE, makeRoutes(PORT_B), "utf-8");

    process.emit("SIGHUP");
    // Allow async reload (ProxyManager.build reads file, validates, builds router)
    await delay(300);

    const res = await request.get("/api");
    expect(res.status).toBe(200);
    expect(res.body.instance).toBe("B");
  });

  it("routes back to upstream A after another SIGHUP reload", async () => {
    await writeFile(TEMP_ROUTES_FILE, makeRoutes(PORT_A), "utf-8");
    process.emit("SIGHUP");
    await delay(300);

    const res = await request.get("/api");
    expect(res.status).toBe(200);
    expect(res.body.instance).toBe("A");
  });

  it("keeps serving from current config when routes file contains invalid JSON", async () => {
    await writeFile(TEMP_ROUTES_FILE, "not valid json", "utf-8");
    process.emit("SIGHUP");
    await delay(300);

    // Still hits upstream A (last good config)
    const res = await request.get("/api");
    expect(res.status).toBe(200);
    expect(res.body.instance).toBe("A");

    // Restore for any follow-on tests
    await writeFile(TEMP_ROUTES_FILE, makeRoutes(PORT_A), "utf-8");
  });
});
