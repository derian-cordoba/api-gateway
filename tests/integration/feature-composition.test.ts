/**
 * Integration tests for combined middleware features on the same route.
 *
 * Verifies that auth, rate-limit, and circuit-breaker middleware all stack
 * correctly and each independently applies its policy without interference.
 *
 * Port allocation:
 *   19_130 — always-200 upstream
 *   19_131 — always-500 upstream (for circuit-breaker tripping)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import { Server } from "../../src/apps/api-gateway/Server";

const GOOD_PORT = 19_130;
const BAD_PORT = 19_131;
const JWT_SECRET = "composition-test-secret";

function startGoodUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(GOOD_PORT, () => resolve(server));
  });
}

function startBadUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "always fails" }));
    });
    server.listen(BAD_PORT, () => resolve(server));
  });
}

describe("Feature composition — integration", () => {
  let good: HttpServer;
  let bad: HttpServer;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    [good, bad] = await Promise.all([startGoodUpstream(), startBadUpstream()]);

    process.env.ROUTES = JSON.stringify([
      // auth + rate-limit combined
      {
        baseURL: "/auth-ratelimit",
        proxy: {
          target: `http://localhost:${GOOD_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/auth-ratelimit": "" },
        },
        auth: { enabled: true, strategy: "jwt", secret: JWT_SECRET },
        rateLimit: { max: 3, windowMs: 60_000 },
      },
      // auth + circuit-breaker combined (circuit trips fast)
      {
        baseURL: "/auth-cb",
        proxy: {
          target: `http://localhost:${BAD_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/auth-cb": "" },
        },
        auth: { enabled: true, strategy: "jwt", secret: JWT_SECRET },
        circuitBreaker: { threshold: 2, timeout: 30_000 },
      },
      // auth + cache combined
      {
        baseURL: "/auth-cache",
        proxy: {
          target: `http://localhost:${GOOD_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/auth-cache": "" },
        },
        auth: { enabled: true, strategy: "jwt", secret: JWT_SECRET },
        cache: { ttl: 10_000 },
      },
    ]);

    const gateway = new Server();
    await gateway.init();
    request = supertest(gateway.getApp());
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await Promise.all([
      new Promise<void>((r) => good.close(() => r())),
      new Promise<void>((r) => bad.close(() => r())),
    ]);
  });

  // ── auth + rate-limit ─────────────────────────────────────────────────────

  describe("auth + rate-limit", () => {
    const validToken = () => jwt.sign({ sub: "u1" }, JWT_SECRET, { algorithm: "HS256" });

    it("returns 401 when token is missing (auth runs before rate-limit)", async () => {
      const res = await request.get("/auth-ratelimit");
      expect(res.status).toBe(401);
    });

    it("proxies successfully with a valid token within the rate window", async () => {
      const res = await request
        .get("/auth-ratelimit")
        .set("Authorization", `Bearer ${validToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("returns 429 after the rate limit is exceeded", async () => {
      // max is 3 per window; one request above already consumed 1 hit.
      // Send 3 more to exhaust the window. Note: rate-limit persists per store.
      for (let i = 0; i < 2; i++) {
        await request
          .get("/auth-ratelimit")
          .set("Authorization", `Bearer ${validToken()}`);
      }
      const res = await request
        .get("/auth-ratelimit")
        .set("Authorization", `Bearer ${validToken()}`);
      expect(res.status).toBe(429);
    });
  });

  // ── auth + circuit-breaker ────────────────────────────────────────────────

  describe("auth + circuit-breaker", () => {
    const validToken = () => jwt.sign({ sub: "u2" }, JWT_SECRET, { algorithm: "HS256" });

    it("returns 401 for unauthenticated requests even when circuit is closed", async () => {
      const res = await request.get("/auth-cb");
      expect(res.status).toBe(401);
    });

    it("returns upstream 5xx while circuit is still closed", async () => {
      const res = await request
        .get("/auth-cb")
        .set("Authorization", `Bearer ${validToken()}`);
      expect(res.status).toBe(500);
    });

    it("opens the circuit after threshold failures and returns 503", async () => {
      // Trip the circuit (threshold = 2, one failure already recorded)
      await request
        .get("/auth-cb")
        .set("Authorization", `Bearer ${validToken()}`);

      const res = await request
        .get("/auth-cb")
        .set("Authorization", `Bearer ${validToken()}`);
      expect(res.status).toBe(503);
    });
  });

  // ── auth + cache ──────────────────────────────────────────────────────────

  describe("auth + cache", () => {
    const validToken = () => jwt.sign({ sub: "u3" }, JWT_SECRET, { algorithm: "HS256" });

    it("returns 401 for unauthenticated requests (auth before cache check)", async () => {
      const res = await request.get("/auth-cache");
      expect(res.status).toBe(401);
    });

    it("caches the upstream response for authenticated requests", async () => {
      const token = validToken();
      const res1 = await request
        .get("/auth-cache")
        .set("Authorization", `Bearer ${token}`);
      expect(res1.status).toBe(200);
      expect(res1.headers["x-cache"]).toBe("MISS");

      const res2 = await request
        .get("/auth-cache")
        .set("Authorization", `Bearer ${token}`);
      expect(res2.status).toBe(200);
      expect(res2.headers["x-cache"]).toBe("HIT");
    });
  });
});
