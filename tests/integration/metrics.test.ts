/**
 * Integration tests for the Prometheus metrics endpoint.
 *
 * Upstream (port 19_080) — simple echo server.
 * We verify that GET /metrics returns valid Prometheus text format and that
 * the per-route counters/histograms are present after making requests.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_080;

function startUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(UPSTREAM_PORT, () => resolve(server));
  });
}

describe("Prometheus metrics endpoint", () => {
  let upstreamServer: HttpServer;
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    upstreamServer = await startUpstream();

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/api",
        proxy: {
          target: `http://localhost:${UPSTREAM_PORT}`,
          changeOrigin: true,
          pathRewrite: { "^/api": "" },
        },
      },
    ]);

    const gateway = new Server();
    await gateway.init();
    request = supertest(gateway.getApp());

    // Warm up the route so metrics are non-zero
    await request.get("/api");
    await request.get("/api");
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await new Promise<void>((resolve) => upstreamServer.close(() => resolve()));
  });

  it("returns 200 with Prometheus content type", async () => {
    const res = await request.get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  it("includes gateway_requests_total metric", async () => {
    const res = await request.get("/metrics");
    expect(res.text).toContain("gateway_requests_total");
  });

  it("includes gateway_request_duration_seconds histogram", async () => {
    const res = await request.get("/metrics");
    expect(res.text).toContain("gateway_request_duration_seconds");
  });

  it("includes gateway_upstream_errors_total metric", async () => {
    const res = await request.get("/metrics");
    expect(res.text).toContain("gateway_upstream_errors_total");
  });

  it("includes gateway_cache_hits_total metric", async () => {
    const res = await request.get("/metrics");
    expect(res.text).toContain("gateway_cache_hits_total");
  });

  it("shows route label for the /api route", async () => {
    const res = await request.get("/metrics");
    expect(res.text).toContain('route="/api"');
  });

  it("accumulates request count across calls", async () => {
    const res = await request.get("/metrics");
    // We made 2 requests in beforeAll plus any additional — value should be >= 2
    const match = res.text.match(
      /gateway_requests_total\{route="\/api",method="GET",status_code="200"\}\s+(\d+)/,
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(2);
  });
});
