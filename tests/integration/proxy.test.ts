import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_001;

function startUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const upstream = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            proxied: true,
            method: req.method,
            path: req.url,
            body: body ? JSON.parse(body) : null,
          })
        );
      });
    });
    upstream.listen(UPSTREAM_PORT, () => resolve(upstream));
  });
}

describe("Proxy routes", () => {
  let upstream: HttpServer;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    upstream = await startUpstream();

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/test",
        proxy: {
          target: `http://localhost:${UPSTREAM_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/test": "" },
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

  it("proxies a GET request to the upstream", async () => {
    const res = await request.get("/test");
    expect(res.status).toBe(200);
    expect(res.body.proxied).toBe(true);
  });

  it("applies pathRewrite before forwarding", async () => {
    const res = await request.get("/test/users/1");
    expect(res.status).toBe(200);
    expect(res.body.path).toBe("/users/1");
  });

  it("forwards the request method", async () => {
    const res = await request.post("/test/items");
    expect(res.status).toBe(200);
    expect(res.body.method).toBe("POST");
  });

  it("forwards a JSON body on POST", async () => {
    const payload = { name: "Alice", role: "admin" };
    const res = await request
      .post("/test/users")
      .set("Content-Type", "application/json")
      .send(payload);
    expect(res.status).toBe(200);
    expect(res.body.body).toEqual(payload);
  });
});
