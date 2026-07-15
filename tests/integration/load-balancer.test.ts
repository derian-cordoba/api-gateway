import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";
import { validateRoutes } from "../../src/apps/api-gateway/routes/RouteValidator";

const UPSTREAM_PORT_A = 19_030;
const UPSTREAM_PORT_B = 19_031;

function startUpstream(port: number): Promise<HttpServer> {
  return new Promise((resolve) => {
    const upstream = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ port }));
    });
    upstream.listen(port, () => resolve(upstream));
  });
}

describe("Load balancer integration", () => {
  let upstreamA: HttpServer;
  let upstreamB: HttpServer;

  beforeAll(async () => {
    upstreamA = await startUpstream(UPSTREAM_PORT_A);
    upstreamB = await startUpstream(UPSTREAM_PORT_B);
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await new Promise<void>((resolve) => upstreamA.close(() => resolve()));
    await new Promise<void>((resolve) => upstreamB.close(() => resolve()));
  });

  describe("round-robin strategy", () => {
    let request: ReturnType<typeof supertest>;

    beforeAll(async () => {
      process.env.ROUTES = JSON.stringify([
        {
          baseURL: "/lb",
          proxy: {
            targets: [
              { url: `http://localhost:${UPSTREAM_PORT_A}` },
              { url: `http://localhost:${UPSTREAM_PORT_B}` },
            ],
            changeOrigin: true,
          },
        },
      ]);

      const gateway = new Server();
      await gateway.init();
      request = supertest(gateway.getApp());
    });

    afterAll(() => {
      delete process.env.ROUTES;
    });

    it("distributes requests across both upstreams in round-robin order", async () => {
      const res1 = await request.get("/lb");
      const res2 = await request.get("/lb");
      const res3 = await request.get("/lb");
      const res4 = await request.get("/lb");

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
      expect(res4.status).toBe(200);

      const ports = [res1.body.port, res2.body.port, res3.body.port, res4.body.port];

      // Should alternate between the two upstreams
      expect(ports[0]).toBe(UPSTREAM_PORT_A);
      expect(ports[1]).toBe(UPSTREAM_PORT_B);
      expect(ports[2]).toBe(UPSTREAM_PORT_A);
      expect(ports[3]).toBe(UPSTREAM_PORT_B);
    });
  });

  describe("weighted strategy", () => {
    let request: ReturnType<typeof supertest>;

    beforeAll(async () => {
      process.env.ROUTES = JSON.stringify([
        {
          baseURL: "/weighted",
          proxy: {
            targets: [
              { url: `http://localhost:${UPSTREAM_PORT_A}`, weight: 1 },
              { url: `http://localhost:${UPSTREAM_PORT_B}`, weight: 3 },
            ],
            strategy: "weighted",
            changeOrigin: true,
          },
        },
      ]);

      const gateway = new Server();
      await gateway.init();
      request = supertest(gateway.getApp());
    });

    afterAll(() => {
      delete process.env.ROUTES;
    });

    it("distributes according to weights (1:3 ratio over 8 requests)", async () => {
      const ports: number[] = [];
      for (let i = 0; i < 8; i++) {
        const res = await request.get("/weighted");
        expect(res.status).toBe(200);
        ports.push(res.body.port as number);
      }

      const countA = ports.filter((p) => p === UPSTREAM_PORT_A).length;
      const countB = ports.filter((p) => p === UPSTREAM_PORT_B).length;

      // Expanded: [a, b, b, b] repeating — 2 hits to A, 6 hits to B over 8 requests
      expect(countA).toBe(2);
      expect(countB).toBe(6);
    });
  });

  describe("least-connections strategy", () => {
    let request: ReturnType<typeof supertest>;

    beforeAll(async () => {
      process.env.ROUTES = JSON.stringify([
        {
          baseURL: "/lc",
          proxy: {
            targets: [
              { url: `http://localhost:${UPSTREAM_PORT_A}` },
              { url: `http://localhost:${UPSTREAM_PORT_B}` },
            ],
            strategy: "least-connections",
            changeOrigin: true,
          },
        },
      ]);

      const gateway = new Server();
      await gateway.init();
      request = supertest(gateway.getApp());
    });

    afterAll(() => {
      delete process.env.ROUTES;
    });

    it("returns 200 from both upstreams with least-connections strategy", async () => {
      // Send both requests concurrently so the second pick sees the first
      // connection already in-flight (count=1 on target A), causing it to
      // choose target B instead of always defaulting to the first target.
      const [res1, res2] = await Promise.all([
        request.get("/lc"),
        request.get("/lc"),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Both upstreams should have been used across the two concurrent requests
      const usedPorts = new Set([res1.body.port as number, res2.body.port as number]);
      expect(usedPorts.size).toBe(2);
    });
  });

  describe("schema validation", () => {
    it("targets requires at least 2 entries", () => {
      expect(() =>
        validateRoutes([
          {
            baseURL: "/lb",
            proxy: {
              targets: [{ url: "http://localhost:3001" }],
            },
          },
        ])
      ).toThrow("Load balancer requires at least two targets");
    });

    it("cannot set both target and targets", () => {
      expect(() =>
        validateRoutes([
          {
            baseURL: "/lb",
            proxy: {
              target: "http://localhost:3001",
              targets: [
                { url: "http://localhost:3001" },
                { url: "http://localhost:3002" },
              ],
            },
          },
        ])
      ).toThrow("Proxy must have exactly one of: target (single URL) or targets (load-balanced array)");
    });

    it("strategy without targets is rejected", () => {
      expect(() =>
        validateRoutes([
          {
            baseURL: "/lb",
            proxy: {
              target: "http://localhost:3001",
              strategy: "round-robin",
            },
          },
        ])
      ).toThrow("strategy is only valid when targets is set");
    });

    it("neither target nor targets is rejected", () => {
      expect(() =>
        validateRoutes([
          {
            baseURL: "/lb",
            proxy: {},
          },
        ])
      ).toThrow();
    });

    it("accepts valid targets configuration", () => {
      const [route] = validateRoutes([
        {
          baseURL: "/lb",
          proxy: {
            targets: [
              { url: "http://localhost:3001", weight: 1 },
              { url: "http://localhost:3002", weight: 2 },
            ],
            strategy: "weighted",
            changeOrigin: true,
          },
        },
      ]);

      expect(route.proxy.targets).toHaveLength(2);
      expect(route.proxy.strategy).toBe("weighted");
    });
  });
});
