import { describe, it, expect } from "vitest";
import { createServer } from "http";
import supertest from "supertest";
import { createRequestIdMiddleware, REQUEST_ID_HEADER } from "../../../src/apps/api-gateway/middleware/requestId";
import express from "express";

function buildApp() {
  const app = express();
  app.use(createRequestIdMiddleware());
  app.get("/test", (req, res) => {
    res.json({ requestId: req.headers[REQUEST_ID_HEADER] });
  });
  return app;
}

describe("createRequestIdMiddleware", () => {
  const request = supertest(buildApp());

  it("generates a UUID when no X-Request-ID header is sent", async () => {
    const res = await request.get("/test");
    const id = res.headers[REQUEST_ID_HEADER];
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("echoes the generated ID in the response header", async () => {
    const res = await request.get("/test");
    expect(res.headers[REQUEST_ID_HEADER]).toBe(res.body.requestId);
  });

  it("forwards an existing X-Request-ID header unchanged", async () => {
    const existingId = "my-correlation-id-12345";
    const res = await request.get("/test").set(REQUEST_ID_HEADER, existingId);
    expect(res.headers[REQUEST_ID_HEADER]).toBe(existingId);
    expect(res.body.requestId).toBe(existingId);
  });

  it("generates a different UUID for each request", async () => {
    const [res1, res2] = await Promise.all([request.get("/test"), request.get("/test")]);
    expect(res1.headers[REQUEST_ID_HEADER]).not.toBe(res2.headers[REQUEST_ID_HEADER]);
  });

  it("sets the ID on req.headers so downstream middleware can read it", async () => {
    const existingId = "downstream-check-id";
    const res = await request.get("/test").set(REQUEST_ID_HEADER, existingId);
    // The route handler echoes req.headers[REQUEST_ID_HEADER] in the body
    expect(res.body.requestId).toBe(existingId);
  });

  it("does not reject empty string header — falls back to generated UUID", async () => {
    // An empty string header is falsy; middleware generates a new UUID
    const res = await request.get("/test").set(REQUEST_ID_HEADER, "");
    // Node/supertest may omit an empty-value header; if it's present it's empty
    // Either way a valid ID ends up in the response
    const responseId = res.headers[REQUEST_ID_HEADER];
    expect(typeof responseId).toBe("string");
    expect(responseId.length).toBeGreaterThan(0);
  });
});
