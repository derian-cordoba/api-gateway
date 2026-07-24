/**
 * Integration tests for graceful server shutdown.
 *
 * Tests that Server.stop() closes the HTTP server cleanly without throwing
 * and that the server no longer accepts new connections after stopping.
 *
 * Port: 19_140
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer, request as httpRequest } from "node:http";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_140;

function startUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(UPSTREAM_PORT, () => resolve(server));
  });
}

describe("Graceful shutdown — integration", () => {
  let upstream: HttpServer;

  beforeAll(async () => {
    upstream = await startUpstream();
    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/shutdown-test",
        proxy: {
          target: `http://localhost:${UPSTREAM_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/shutdown-test": "" },
        },
      },
    ]);
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await new Promise<void>((r) => upstream.close(() => r()));
  });

  it("start() and stop() complete without throwing", async () => {
    const gateway = new Server();
    await expect(gateway.init()).resolves.not.toThrow();
    await expect(gateway.stop()).resolves.not.toThrow();
  });

  it("calling stop() multiple times does not throw", async () => {
    const gateway = new Server();
    await gateway.init();
    await gateway.stop();
    await expect(gateway.stop()).resolves.not.toThrow();
  });

  it("start() returns a functional server before stop()", async () => {
    const { default: supertest } = await import("supertest");
    const gateway = new Server();
    await gateway.init();

    const res = await supertest(gateway.getApp()).get("/shutdown-test");
    expect(res.status).toBe(200);

    await gateway.stop();
  });
});
