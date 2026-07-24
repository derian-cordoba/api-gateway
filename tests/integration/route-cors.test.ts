/**
 * Integration tests for per-route CORS override.
 *
 * The global CORS policy allows all origins. Each tested route overrides it
 * with a specific origin so we can assert that per-route policy wins.
 *
 * Port: 19_110
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_110;

function startUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(UPSTREAM_PORT, () => resolve(server));
  });
}

describe("Per-route CORS override — integration", () => {
  let upstream: HttpServer;
  let request: ReturnType<typeof supertest>;
  const target = `http://localhost:${UPSTREAM_PORT}`;

  beforeAll(async () => {
    upstream = await startUpstream();

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/single-origin",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/single-origin": "" } },
        cors: { origin: "https://allowed.example.com", credentials: true },
      },
      {
        baseURL: "/multi-origin",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/multi-origin": "" } },
        cors: {
          origin: ["https://a.example.com", "https://b.example.com"],
          methods: ["GET", "POST"],
          allowedHeaders: ["Content-Type"],
        },
      },
      {
        baseURL: "/open",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/open": "" } },
        cors: { origin: true },
      },
      {
        baseURL: "/no-cors",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/no-cors": "" } },
      },
    ]);

    const gateway = new Server();
    await gateway.init();
    request = supertest(gateway.getApp());
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await new Promise<void>((r) => upstream.close(() => r()));
  });

  describe("Single allowed origin", () => {
    it("sets Access-Control-Allow-Origin for the configured origin", async () => {
      const res = await request
        .get("/single-origin")
        .set("Origin", "https://allowed.example.com");
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example.com");
    });

    it("includes credentials header when credentials: true", async () => {
      const res = await request
        .get("/single-origin")
        .set("Origin", "https://allowed.example.com");
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("handles OPTIONS preflight for the allowed origin", async () => {
      const res = await request
        .options("/single-origin")
        .set("Origin", "https://allowed.example.com")
        .set("Access-Control-Request-Method", "GET");
      expect([200, 204]).toContain(res.status);
      expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example.com");
    });
  });

  describe("Multiple allowed origins", () => {
    it("reflects the first listed origin when it matches", async () => {
      const res = await request
        .get("/multi-origin")
        .set("Origin", "https://a.example.com");
      expect(res.headers["access-control-allow-origin"]).toBe("https://a.example.com");
    });

    it("reflects the second listed origin when it matches", async () => {
      const res = await request
        .get("/multi-origin")
        .set("Origin", "https://b.example.com");
      expect(res.headers["access-control-allow-origin"]).toBe("https://b.example.com");
    });
  });

  describe("Open CORS (origin: true)", () => {
    it("reflects any origin back", async () => {
      const res = await request
        .get("/open")
        .set("Origin", "https://any.domain.io");
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://any.domain.io");
    });
  });

  describe("Route without CORS config", () => {
    it("still proxies the request successfully", async () => {
      const res = await request.get("/no-cors");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
