/**
 * Integration tests for per-route header transformation.
 *
 * Upstream echoes all received request headers as JSON so we can assert
 * which headers arrived (or were suppressed). Response headers set/remove
 * are verified on the gateway response.
 *
 * Port: 19_100
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer, type IncomingMessage } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_100;

function startEchoUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((req: IncomingMessage, res) => {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "X-Upstream-Sent": "yes",
        "X-Should-Remove": "remove-me",
      });
      res.end(JSON.stringify({ receivedHeaders: req.headers }));
    });
    server.listen(UPSTREAM_PORT, () => resolve(server));
  });
}

describe("Header transformation — integration", () => {
  let upstream: HttpServer;
  let request: ReturnType<typeof supertest>;
  const target = `http://localhost:${UPSTREAM_PORT}`;

  beforeAll(async () => {
    upstream = await startEchoUpstream();

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/req-transform",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/req-transform": "" } },
        headers: {
          request: {
            set: { "X-Injected": "injected-value", "X-Request-Source": "gateway" },
            remove: ["X-Client-Secret"],
          },
        },
      },
      {
        baseURL: "/res-transform",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/res-transform": "" } },
        headers: {
          response: {
            set: { "X-Gateway-Version": "1.3.0" },
            remove: ["X-Should-Remove"],
          },
        },
      },
      {
        baseURL: "/both-transform",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/both-transform": "" } },
        headers: {
          request: {
            set: { "X-Gateway-Request": "true" },
            remove: ["X-Client-Secret"],
          },
          response: {
            set: { "X-Gateway-Response": "true" },
            remove: ["X-Should-Remove"],
          },
        },
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

  describe("Request header transforms", () => {
    it("injects configured request headers before forwarding to upstream", async () => {
      const res = await request.get("/req-transform");
      expect(res.status).toBe(200);
      const headers = res.body.receivedHeaders as Record<string, string>;
      expect(headers["x-injected"]).toBe("injected-value");
      expect(headers["x-request-source"]).toBe("gateway");
    });

    it("removes configured request headers before forwarding to upstream", async () => {
      const res = await request
        .get("/req-transform")
        .set("X-Client-Secret", "super-secret");
      const headers = res.body.receivedHeaders as Record<string, string>;
      expect(headers["x-client-secret"]).toBeUndefined();
    });

    it("forwards headers that are not in the remove list", async () => {
      const res = await request
        .get("/req-transform")
        .set("X-Keep-Me", "keep");
      const headers = res.body.receivedHeaders as Record<string, string>;
      expect(headers["x-keep-me"]).toBe("keep");
    });
  });

  describe("Response header transforms", () => {
    it("adds configured response headers to the gateway reply", async () => {
      const res = await request.get("/res-transform");
      expect(res.status).toBe(200);
      expect(res.headers["x-gateway-version"]).toBe("1.3.0");
    });

    it("removes configured response headers from the gateway reply", async () => {
      const res = await request.get("/res-transform");
      expect(res.headers["x-should-remove"]).toBeUndefined();
    });

    it("forwards upstream headers that are not in the remove list", async () => {
      const res = await request.get("/res-transform");
      expect(res.headers["x-upstream-sent"]).toBe("yes");
    });
  });

  describe("Combined request + response transforms", () => {
    it("applies both request and response transforms independently", async () => {
      const res = await request
        .get("/both-transform")
        .set("X-Client-Secret", "must-go");
      expect(res.status).toBe(200);
      // Request transform: injected header arrived at upstream
      const headers = res.body.receivedHeaders as Record<string, string>;
      expect(headers["x-gateway-request"]).toBe("true");
      // Request transform: removed header did not arrive at upstream
      expect(headers["x-client-secret"]).toBeUndefined();
      // Response transform: added header on response
      expect(res.headers["x-gateway-response"]).toBe("true");
      // Response transform: upstream header removed
      expect(res.headers["x-should-remove"]).toBeUndefined();
    });
  });
});
