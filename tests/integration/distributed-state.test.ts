import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";
import { CircuitState } from "../../src/apps/api-gateway/middleware/circuit-breaker/CircuitBreaker";
import type { CircuitBreakerSnapshot } from "../../src/apps/api-gateway/middleware/circuit-breaker/CircuitBreakerStateStore";
import type { CacheEntry } from "../../src/apps/api-gateway/middleware/cache/ResponseCache";

const UPSTREAM_PORT = 19_182;

describe("shared runtime stores across gateway instances", () => {
  let upstream: HttpServer;
  let first: Server;
  let second: Server;
  let upstreamCalls = 0;
  const cacheEntries = new Map<string, CacheEntry>();
  const breakerSnapshots = new Map<string, CircuitBreakerSnapshot>();
  const rateCounts = new Map<string, number>();

  beforeAll(async () => {
    upstream = await new Promise((resolve) => {
      const server = createServer((req, res) => {
        upstreamCalls++;
        res.setHeader("Content-Type", "application/json");
        res.statusCode = req.headers["x-test-kind"] === "breaker" ? 500 : 200;
        res.end(JSON.stringify({ calls: upstreamCalls }));
      });
      server.listen(UPSTREAM_PORT, () => resolve(server));
    });

    process.env.ROUTES = JSON.stringify([
      { baseURL: "/p2-cache", proxy: { target: `http://localhost:${UPSTREAM_PORT}`, pathRewrite: { "^/p2-cache": "" } }, cache: { ttl: 10_000 } },
      { baseURL: "/p2-breaker", proxy: { target: `http://localhost:${UPSTREAM_PORT}`, headers: { "x-test-kind": "breaker" } }, circuitBreaker: { threshold: 1, timeout: 30_000 } },
      { baseURL: "/p2-limit", proxy: { target: `http://localhost:${UPSTREAM_PORT}`, pathRewrite: { "^/p2-limit": "" } }, rateLimit: { max: 1, windowMs: 60_000 } },
    ]);

    const options = {
      cacheStoreFactory: () => ({
        get: async (key: string) => cacheEntries.get(key) ?? null,
        set: async (key: string, entry: CacheEntry) => { cacheEntries.set(key, entry); },
        clear: async () => { cacheEntries.clear(); },
        size: () => cacheEntries.size,
      }),
      circuitBreakerStoreFactory: () => ({
        load: async (key: string) => breakerSnapshots.get(key) ?? null,
        save: async (key: string, snapshot: CircuitBreakerSnapshot) => { breakerSnapshots.set(key, snapshot); },
        deleteSnapshot: async (key: string) => { breakerSnapshots.delete(key); },
      }),
      rateLimitStoreFactory: () => ({
        increment: async (key: string) => {
          const totalHits = (rateCounts.get(key) ?? 0) + 1;
          rateCounts.set(key, totalHits);
          return { totalHits, resetTime: new Date(Date.now() + 60_000) };
        },
        decrement: async (key: string) => { rateCounts.set(key, (rateCounts.get(key) ?? 1) - 1); },
        resetKey: async (key: string) => { rateCounts.delete(key); },
      }),
    };
    first = new Server(options);
    second = new Server(options);
    await first.init();
    await second.init();
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await Promise.all([first.stop(), second.stop()]);
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  it("serves a response cached by another instance", async () => {
    const initial = await supertest(first.getApp()).get("/p2-cache/item");
    await vi.waitFor(() => expect(cacheEntries.size).toBe(1));
    const fromSecond = await supertest(second.getApp()).get("/p2-cache/item");

    expect(initial.headers["x-cache"]).toBe("MISS");
    expect(fromSecond.headers["x-cache"]).toBe("HIT");
    expect(fromSecond.body.calls).toBe(initial.body.calls);
  });

  it("uses a circuit opened by another instance", async () => {
    const failed = await supertest(first.getApp()).get("/p2-breaker");
    expect(failed.status).toBe(500);
    await vi.waitFor(() => expect(breakerSnapshots.get("/p2-breaker")?.state).toBe(CircuitState.OPEN));

    const rejected = await supertest(second.getApp()).get("/p2-breaker");
    expect(rejected.status).toBe(503);
  });

  it("shares rate-limit counters across instances", async () => {
    const allowed = await supertest(first.getApp()).get("/p2-limit");
    const rejected = await supertest(second.getApp()).get("/p2-limit");
    expect(allowed.status).toBe(200);
    expect(rejected.status).toBe(429);
  });
});
