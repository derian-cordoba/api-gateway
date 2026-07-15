import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

// MARK: Helpers

function startUpstream(port: number, handler: (req: unknown, res: { writeHead: Function; end: Function }) => void): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer(handler as never);
    server.listen(port, () => resolve(server));
  });
}

async function closeServer(server: HttpServer): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function startGateway(routes: object[]): Promise<ReturnType<typeof supertest>> {
  process.env.ROUTES = JSON.stringify(routes);
  const gateway = new Server();
  await gateway.init();
  return supertest(gateway.getApp());
}

// Ports — must not collide with other integration test files (19_001, 19_002)
const PORTS = {
  lifecycle: 19_010,
  probeFailure: 19_011,
  networkError: 19_012,
} as const;

// A very short timeout so integration tests don't have to sleep long.
const CB_TIMEOUT_MS = 100;

// MARK: Suite 1 — full lifecycle with 5xx upstream responses

describe("Circuit breaker — lifecycle (5xx failures)", () => {
  let upstream: HttpServer;
  let request: ReturnType<typeof supertest>;
  let upstreamStatus = 200;

  beforeAll(async () => {
    upstreamStatus = 200;
    upstream = await startUpstream(PORTS.lifecycle, (_req, res) => {
      res.writeHead(upstreamStatus, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ proxied: true }));
    });

    request = await startGateway([
      {
        baseURL: "/cb",
        proxy: {
          target: `http://localhost:${PORTS.lifecycle}`,
          changeOrigin: true,
          pathRewrite: { "^/cb": "" },
        },
        circuitBreaker: { threshold: 3, timeout: CB_TIMEOUT_MS, successThreshold: 1 },
      },
    ]);
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await closeServer(upstream);
  });

  // NOTE: tests within this block are intentionally stateful — they exercise
  // the circuit breaker lifecycle in sequence: CLOSED → OPEN → HALF_OPEN → CLOSED.

  it("proxies requests normally in CLOSED state", async () => {
    upstreamStatus = 200;
    const res = await request.get("/cb/ping");
    expect(res.status).toBe(200);
    expect(res.body.proxied).toBe(true);
  });

  it("passes upstream 5xx responses through to the client (does not short-circuit yet)", async () => {
    upstreamStatus = 500;
    const res = await request.get("/cb/ping");
    expect(res.status).toBe(500); // failure #1 — still below threshold
  });

  it("opens the circuit once the failure threshold is reached", async () => {
    upstreamStatus = 500;
    // Failures #2 and #3 reach the threshold
    await request.get("/cb/ping"); // #2
    await request.get("/cb/ping"); // #3 — threshold reached, circuit OPEN

    // Next request is short-circuited by the gateway
    upstreamStatus = 200; // irrelevant — gateway won't reach upstream
    const res = await request.get("/cb/ping");
    expect(res.status).toBe(503);
  });

  it("returns a JSON error body when the circuit is OPEN", async () => {
    const res = await request.get("/cb/ping");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Service Unavailable");
    expect(typeof res.body.message).toBe("string");
  });

  it("includes a Retry-After header when the circuit is OPEN", async () => {
    const res = await request.get("/cb/ping");
    expect(res.status).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(Number(res.headers["retry-after"])).toBeGreaterThanOrEqual(0);
  });

  it("allows a probe request through once the timeout elapses (HALF_OPEN)", async () => {
    upstreamStatus = 200; // upstream is healthy again
    await new Promise((r) => setTimeout(r, CB_TIMEOUT_MS + 50));
    const res = await request.get("/cb/ping");
    // Probe reaches the upstream and succeeds → circuit closes
    expect(res.status).toBe(200);
  });

  it("resumes normal proxying after the circuit closes", async () => {
    upstreamStatus = 200;
    const res = await request.get("/cb/ping");
    expect(res.status).toBe(200);
    expect(res.body.proxied).toBe(true);
  });
});

// MARK: Suite 2 — HALF_OPEN probe failure re-opens the circuit

describe("Circuit breaker — HALF_OPEN probe failure re-opens circuit", () => {
  let upstream: HttpServer;
  let request: ReturnType<typeof supertest>;
  let upstreamStatus = 500;

  beforeAll(async () => {
    upstreamStatus = 500;
    upstream = await startUpstream(PORTS.probeFailure, (_req, res) => {
      res.writeHead(upstreamStatus, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ proxied: true }));
    });

    request = await startGateway([
      {
        baseURL: "/cb2",
        proxy: {
          target: `http://localhost:${PORTS.probeFailure}`,
          changeOrigin: true,
          pathRewrite: { "^/cb2": "" },
        },
        circuitBreaker: { threshold: 3, timeout: CB_TIMEOUT_MS, successThreshold: 1 },
      },
    ]);
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await closeServer(upstream);
  });

  it("opens the circuit after threshold 5xx failures", async () => {
    for (let i = 0; i < 3; i++) await request.get("/cb2/ping");
    const res = await request.get("/cb2/ping");
    expect(res.status).toBe(503);
  });

  it("lets the probe through after the timeout and records the 5xx as a failure", async () => {
    upstreamStatus = 500; // upstream still broken
    await new Promise((r) => setTimeout(r, CB_TIMEOUT_MS + 50));
    const res = await request.get("/cb2/ping"); // probe
    // The upstream's 500 is proxied to the client; proxyRes records the failure.
    expect(res.status).toBe(500);
  });

  it("re-opens the circuit immediately after the probe fails", async () => {
    const res = await request.get("/cb2/ping");
    expect(res.status).toBe(503); // circuit is OPEN again
    expect(res.body.error).toBe("Service Unavailable");
  });
});

// MARK: Suite 3 — network errors (upstream is unreachable)

describe("Circuit breaker — network errors open the circuit", () => {
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    // Nothing is listening on PORTS.networkError — every proxy attempt will
    // result in ECONNREFUSED, triggering the on.error handler.
    request = await startGateway([
      {
        baseURL: "/cb3",
        proxy: {
          target: `http://localhost:${PORTS.networkError}`,
          changeOrigin: true,
          pathRewrite: { "^/cb3": "" },
        },
        circuitBreaker: { threshold: 3, timeout: CB_TIMEOUT_MS, successThreshold: 1 },
      },
    ]);
  });

  afterAll(() => {
    delete process.env.ROUTES;
  });

  it("returns 502 when the upstream is unreachable (failure #1)", async () => {
    const res = await request.get("/cb3/ping");
    expect(res.status).toBe(502);
  });

  it("returns 502 when the upstream is unreachable (failure #2)", async () => {
    const res = await request.get("/cb3/ping");
    expect(res.status).toBe(502);
  });

  it("returns 503 once the failure threshold is reached", async () => {
    await request.get("/cb3/ping"); // failure #3 — threshold reached
    const res = await request.get("/cb3/ping"); // circuit now OPEN
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Service Unavailable");
  });
});
