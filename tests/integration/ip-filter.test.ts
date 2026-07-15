import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_021;

function startUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const upstream = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ proxied: true }));
    });
    upstream.listen(UPSTREAM_PORT, () => resolve(upstream));
  });
}

describe("IP filter middleware — integration", () => {
  let upstream: HttpServer;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    upstream = await startUpstream();

    const target = `http://localhost:${UPSTREAM_PORT}`;

    process.env.ROUTES = JSON.stringify([
      // Route with an allow list (loopback only — middleware normalises ::ffff:127.0.0.1 → 127.0.0.1)
      {
        baseURL: "/allow-loopback",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/allow-loopback": "" } },
        ipFilter: { allow: ["127.0.0.1"] },
      },
      // Route with a deny list (blocks loopback — same normalisation applies)
      {
        baseURL: "/deny-loopback",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/deny-loopback": "" } },
        ipFilter: { deny: ["127.0.0.1"] },
      },
      // Route open to everyone (no ipFilter)
      {
        baseURL: "/open",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/open": "" } },
      },
    ]);

    const gateway = new Server();
    await gateway.init();
    request = supertest(gateway.getApp());
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  describe("allow list", () => {
    it("allows loopback requests through when loopback is in the allow list", async () => {
      // supertest connects from 127.0.0.1 / ::1
      const res = await request.get("/allow-loopback");
      expect(res.status).toBe(200);
      expect(res.body.proxied).toBe(true);
    });
  });

  describe("deny list", () => {
    it("blocks loopback requests when loopback is in the deny list", async () => {
      const res = await request.get("/deny-loopback");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("includes a descriptive message in the 403 response", async () => {
      const res = await request.get("/deny-loopback");
      expect(res.body.message).toMatch(/not permitted/i);
    });
  });

  describe("no ip filter", () => {
    it("passes requests through when ipFilter is not configured", async () => {
      const res = await request.get("/open");
      expect(res.status).toBe(200);
      expect(res.body.proxied).toBe(true);
    });
  });
});
