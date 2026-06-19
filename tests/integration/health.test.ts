import { describe, it, expect, beforeAll } from "vitest";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

describe("GET /health", () => {
  let request: ReturnType<typeof supertest>;

  beforeAll(async () => {
    const server = new Server();
    await server.init();
    request = supertest(server.getApp());
  });

  it("returns 200 OK", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
  });

  it("returns status: ok", async () => {
    const res = await request.get("/health");
    expect(res.body.status).toBe("ok");
  });

  it("returns a non-negative numeric uptime", async () => {
    const res = await request.get("/health");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("returns a valid ISO 8601 timestamp", async () => {
    const res = await request.get("/health");
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(res.body.timestamp).getTime()).toBeGreaterThan(0);
  });

  it("includes helmet security headers", async () => {
    const res = await request.get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });

  it("includes CORS header", async () => {
    const res = await request.get("/health");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
