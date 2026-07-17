/**
 * Integration test for per-route request timeout.
 *
 * Two upstreams are used:
 *   - fast (port 19_050) — responds immediately
 *   - slow (port 19_051) — delays 2 000 ms before responding
 *
 * The gateway route to /slow has proxy.timeout: 500, so it should receive
 * a 504 before the upstream delivers its response.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const FAST_PORT = 19_050;
const SLOW_PORT = 19_051;
const TIMEOUT_MS = 500;
const UPSTREAM_DELAY_MS = 2_000;

function startFastUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ fast: true }));
    });
    server.listen(FAST_PORT, () => resolve(server));
  });
}

function startSlowUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ slow: true }));
        }
      }, UPSTREAM_DELAY_MS);
    });
    server.listen(SLOW_PORT, () => resolve(server));
  });
}

describe("Request timeout per route", () => {
  let fastUpstream: HttpServer;
  let slowUpstream: HttpServer;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    [fastUpstream, slowUpstream] = await Promise.all([
      startFastUpstream(),
      startSlowUpstream(),
    ]);

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/fast",
        proxy: {
          target: `http://localhost:${FAST_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/fast": "" },
          timeout: TIMEOUT_MS,
        },
      },
      {
        baseURL: "/slow",
        proxy: {
          target: `http://localhost:${SLOW_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/slow": "" },
          timeout: TIMEOUT_MS,
        },
      },
      {
        baseURL: "/no-timeout",
        proxy: {
          target: `http://localhost:${FAST_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/no-timeout": "" },
        },
      },
    ]);

    const gateway = new Server();
    await gateway.init();
    request = supertest(gateway.getApp());
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await Promise.all([
      new Promise<void>((resolve) => fastUpstream.close(() => resolve())),
      new Promise<void>((resolve) => slowUpstream.close(() => resolve())),
    ]);
  });

  it("proxies normally when the upstream responds within the timeout", async () => {
    const res = await request.get("/fast");
    expect(res.status).toBe(200);
    expect(res.body.fast).toBe(true);
  });

  it("returns 504 Gateway Timeout when the upstream is too slow", async () => {
    const res = await request.get("/slow").timeout(UPSTREAM_DELAY_MS + 500);
    expect(res.status).toBe(504);
    expect(res.body.error).toBe("Gateway Timeout");
  });

  it("includes the configured timeout duration in the 504 body", async () => {
    const res = await request.get("/slow").timeout(UPSTREAM_DELAY_MS + 500);
    expect(res.status).toBe(504);
    expect(res.body.message).toContain(`${TIMEOUT_MS}ms`);
  });

  it("routes without timeout: configured behave normally regardless of upstream speed", async () => {
    const res = await request.get("/no-timeout");
    expect(res.status).toBe(200);
    expect(res.body.fast).toBe(true);
  });
});
