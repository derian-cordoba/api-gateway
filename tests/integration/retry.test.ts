/**
 * Integration tests for retry with backoff.
 *
 * Upstreams:
 *   - reliable  (port 19_060) — always responds 200
 *   - flaky     (port 19_061) — responds 500 for the first N calls, then 200
 *   - always500 (port 19_062) — always responds 500
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const RELIABLE_PORT = 19_060;
const FLAKY_PORT = 19_061;
const ALWAYS500_PORT = 19_062;

function startReliable(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(RELIABLE_PORT, () => resolve(server));
  });
}

function startFlaky(failFirst: number): Promise<{ server: HttpServer; reset: () => void }> {
  let callCount = 0;
  const reset = () => { callCount = 0; };
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      callCount++;
      if (callCount <= failFirst) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "transient" }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      }
    });
    server.listen(FLAKY_PORT, () => resolve({ server, reset }));
  });
}

function startAlways500(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "always fail" }));
    });
    server.listen(ALWAYS500_PORT, () => resolve(server));
  });
}

describe("Retry with backoff", () => {
  let reliable: HttpServer;
  let flaky: { server: HttpServer; reset: () => void };
  let always500: HttpServer;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    [reliable, flaky, always500] = await Promise.all([
      startReliable(),
      startFlaky(2), // fails first 2 calls, succeeds on 3rd
      startAlways500(),
    ]);

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/reliable",
        proxy: {
          target: `http://localhost:${RELIABLE_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/reliable": "" },
        },
        retry: { attempts: 3, delay: 10 },
      },
      {
        baseURL: "/flaky",
        proxy: {
          target: `http://localhost:${FLAKY_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/flaky": "" },
        },
        retry: { attempts: 3, delay: 10 },
      },
      {
        baseURL: "/always500",
        proxy: {
          target: `http://localhost:${ALWAYS500_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/always500": "" },
        },
        retry: { attempts: 2, delay: 10 },
      },
      {
        baseURL: "/exponential",
        proxy: {
          target: `http://localhost:${FLAKY_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/exponential": "" },
        },
        retry: { attempts: 3, delay: 5, backoff: "exponential" },
      },
    ]);

    const gateway = new Server();
    await gateway.init();
    request = supertest(gateway.getApp());
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await Promise.all([
      new Promise<void>((resolve) => reliable.close(() => resolve())),
      new Promise<void>((resolve) => flaky.server.close(() => resolve())),
      new Promise<void>((resolve) => always500.close(() => resolve())),
    ]);
  });

  it("proxies normally when upstream responds 200 on first attempt", async () => {
    const res = await request.get("/reliable");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("succeeds after retrying through initial 5xx responses", async () => {
    flaky.reset();
    const res = await request.get("/flaky");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns the upstream 5xx after exhausting all retry attempts", async () => {
    const res = await request.get("/always500");
    expect(res.status).toBe(500);
  });

  it("succeeds with exponential backoff strategy", async () => {
    flaky.reset();
    const res = await request.get("/exponential");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
