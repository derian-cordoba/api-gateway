import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";
import { REQUEST_ID_HEADER } from "../../src/apps/api-gateway/middleware/requestId";

const UPSTREAM_PORT = 19_020;

function startUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const upstream = createServer((req, res) => {
      // Echo the x-request-id that the gateway forwarded to us
      const forwardedId = req.headers[REQUEST_ID_HEADER];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ forwardedId: forwardedId ?? null }));
    });
    upstream.listen(UPSTREAM_PORT, () => resolve(upstream));
  });
}

describe("Request ID propagation — integration", () => {
  let upstream: HttpServer;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    upstream = await startUpstream();

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/echo",
        proxy: {
          target: `http://localhost:${UPSTREAM_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/echo": "" },
        },
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

  it("returns an X-Request-ID response header on every request", async () => {
    const res = await request.get("/echo");
    expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
    expect(typeof res.headers[REQUEST_ID_HEADER]).toBe("string");
  });

  it("generates a UUID v4 when the client does not supply one", async () => {
    const res = await request.get("/echo");
    const id = res.headers[REQUEST_ID_HEADER] as string;
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("forwards the client-supplied ID unchanged in the response header", async () => {
    const myId = "client-correlation-xyz-789";
    const res = await request.get("/echo").set(REQUEST_ID_HEADER, myId);
    expect(res.headers[REQUEST_ID_HEADER]).toBe(myId);
  });

  it("forwards the request ID to the upstream service", async () => {
    const myId = "upstream-correlation-456";
    const res = await request.get("/echo").set(REQUEST_ID_HEADER, myId);
    expect(res.body.forwardedId).toBe(myId);
  });

  it("generates unique IDs for concurrent requests", async () => {
    const results = await Promise.all([
      request.get("/echo"),
      request.get("/echo"),
      request.get("/echo"),
    ]);
    const ids = results.map((r) => r.headers[REQUEST_ID_HEADER]);
    const unique = new Set(ids);
    expect(unique.size).toBe(3);
  });

  it("generated ID is also forwarded to the upstream", async () => {
    const res = await request.get("/echo");
    const responseId = res.headers[REQUEST_ID_HEADER] as string;
    // The upstream echoes whatever it received
    expect(res.body.forwardedId).toBe(responseId);
  });
});
