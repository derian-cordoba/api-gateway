import { describe, expect, it } from "vitest";
import express from "express";
import supertest from "supertest";
import { createTraceContextMiddleware } from "../../../src/apps/api-gateway/middleware/traceContext";

describe("trace context middleware", () => {
  it("creates and propagates a W3C traceparent", async () => {
    const app = express();
    app.use(createTraceContextMiddleware());
    app.get("/", (req, res) => res.json({ traceparent: req.headers.traceparent }));
    const response = await supertest(app).get("/");

    expect(response.headers.traceparent).toMatch(/^00-[\da-f]{32}-[\da-f]{16}-01$/);
    expect(response.body.traceparent).toBe(response.headers.traceparent);
  });

  it("preserves the incoming trace id while creating a new span id", async () => {
    const app = express();
    app.use(createTraceContextMiddleware());
    app.get("/", (req, res) => res.json({ traceparent: req.headers.traceparent }));
    const incoming = "00-0123456789abcdef0123456789abcdef-1111111111111111-01";
    const response = await supertest(app).get("/").set("traceparent", incoming);

    expect(response.headers.traceparent).toMatch(/^00-0123456789abcdef0123456789abcdef-[\da-f]{16}-01$/);
    expect(response.headers.traceparent).not.toBe(incoming);
  });
});
