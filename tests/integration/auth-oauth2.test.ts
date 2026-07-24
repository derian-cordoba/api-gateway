/**
 * Integration tests for the OAuth2 token introspection auth strategy.
 *
 * Runs a real mock introspection server on port 19_090 so we can test all
 * relevant gateway behaviours without any mocking at the module level.
 *
 * Port allocation:
 *   19_090 — upstream API
 *   19_091 — mock OAuth2 introspection endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_090;
const INTROSPECT_PORT = 19_091;

const VALID_TOKEN = "valid-opaque-token-abc";
const INACTIVE_TOKEN = "inactive-token-xyz";
const CLIENT_ID = "gateway-client";
const CLIENT_SECRET = "gateway-secret";

function startUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ proxied: true }));
    });
    server.listen(UPSTREAM_PORT, () => resolve(server));
  });
}

/**
 * A minimal RFC 7662 introspection server.
 * Returns { active: true } for VALID_TOKEN only.
 * Returns HTTP 500 when the path is /error to simulate endpoint failures.
 */
function startIntrospectionServer(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url === "/error") {
        res.writeHead(500);
        res.end("Internal Server Error");
        return;
      }

      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        const params = new URLSearchParams(body);
        const token = params.get("token");
        const active = token === VALID_TOKEN;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ active }));
      });
    });
    server.listen(INTROSPECT_PORT, () => resolve(server));
  });
}

describe("OAuth2 introspection auth — integration", () => {
  let upstream: HttpServer;
  let introspect: HttpServer;
  let request: ReturnType<typeof supertest>;

  const introspectionUrl = `http://localhost:${INTROSPECT_PORT}/introspect`;
  const errorUrl = `http://localhost:${INTROSPECT_PORT}/error`;
  const target = `http://localhost:${UPSTREAM_PORT}`;

  beforeAll(async () => {
    [upstream, introspect] = await Promise.all([
      startUpstream(),
      startIntrospectionServer(),
    ]);

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/protected",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/protected": "" } },
        auth: {
          enabled: true,
          strategy: "oauth2",
          introspectionUrl,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
        },
      },
      {
        baseURL: "/protected-error",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/protected-error": "" } },
        auth: {
          enabled: true,
          strategy: "oauth2",
          introspectionUrl: errorUrl,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
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
      new Promise<void>((r) => upstream.close(() => r())),
      new Promise<void>((r) => introspect.close(() => r())),
    ]);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await request.get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing/i);
  });

  it("returns 401 when Authorization scheme is not Bearer", async () => {
    const res = await request.get("/protected").set("Authorization", "Basic abc123");
    expect(res.status).toBe(401);
  });

  it("proxies the request when token is active", async () => {
    const res = await request
      .get("/protected")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.proxied).toBe(true);
  });

  it("returns 401 when token is inactive", async () => {
    const res = await request
      .get("/protected")
      .set("Authorization", `Bearer ${INACTIVE_TOKEN}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inactive/i);
  });

  it("returns 401 when the introspection endpoint returns a server error", async () => {
    const res = await request
      .get("/protected-error")
      .set("Authorization", `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/introspection failed/i);
  });
});
