/**
 * Integration tests for in-memory response caching.
 *
 * Upstream (port 19_070) — responds with an incrementing counter so we can
 * tell whether the response was fresh or served from cache.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_070;

function startCountingUpstream(): Promise<{ server: HttpServer; getCount: () => number }> {
  let count = 0;
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      count++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        count,
        identity: req.headers.authorization ?? req.headers.cookie ?? "public",
      }));
    });
    server.listen(UPSTREAM_PORT, () => resolve({ server, getCount: () => count }));
  });
}

describe("Response caching", () => {
  let upstream: { server: HttpServer; getCount: () => number };
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    upstream = await startCountingUpstream();

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/cached",
        proxy: {
          target: `http://localhost:${UPSTREAM_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/cached": "" },
        },
        cache: { ttl: 5000 },
      },
      {
        baseURL: "/uncached",
        proxy: {
          target: `http://localhost:${UPSTREAM_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/uncached": "" },
        },
      },
      {
        baseURL: "/identity-cache",
        proxy: {
          target: `http://localhost:${UPSTREAM_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/identity-cache": "" },
        },
        cache: { ttl: 5000 },
      },
    ]);

    const gateway = new Server();
    await gateway.init();
    request = supertest(gateway.getApp());
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
  });

  it("returns a fresh upstream response on the first GET (cache MISS)", async () => {
    const res = await request.get("/cached");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.headers["x-cache"]).toBe("MISS");
  });

  it("serves from cache on subsequent GET (cache HIT — upstream count stays the same)", async () => {
    const countBefore = upstream.getCount();
    const res = await request.get("/cached");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1); // same as first response
    expect(res.headers["x-cache"]).toBe("HIT");
    expect(upstream.getCount()).toBe(countBefore); // upstream not called again
  });

  it("does not cache routes without cache config", async () => {
    const res1 = await request.get("/uncached");
    const res2 = await request.get("/uncached");
    expect(res1.body.count).not.toBe(res2.body.count);
    expect(res2.headers["x-cache"]).toBeUndefined();
  });

  it("cache key is per-URL — different paths are cached independently", async () => {
    const a = await request.get("/cached?q=a");
    const b = await request.get("/cached?q=b");
    // Both should be MISS (first call for each key)
    expect(a.headers["x-cache"]).toBe("MISS");
    expect(b.headers["x-cache"]).toBe("MISS");
    expect(a.body.count).not.toBe(b.body.count);
  });

  it("isolates cached responses by authorization identity", async () => {
    const alice = await request.get("/identity-cache").set("Authorization", "Bearer alice");
    const bob = await request.get("/identity-cache").set("Authorization", "Bearer bob");
    const aliceAgain = await request.get("/identity-cache").set("Authorization", "Bearer alice");

    expect(alice.body.identity).toBe("Bearer alice");
    expect(bob.body.identity).toBe("Bearer bob");
    expect(aliceAgain.body.identity).toBe("Bearer alice");
    expect(alice.headers["x-cache"]).toBe("MISS");
    expect(bob.headers["x-cache"]).toBe("MISS");
    expect(aliceAgain.headers["x-cache"]).toBe("HIT");
  });
});
