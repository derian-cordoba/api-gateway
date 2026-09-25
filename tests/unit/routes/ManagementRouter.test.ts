import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { Registry } from "prom-client";
import { GatewayOperationState } from "../../../src/apps/api-gateway/operations/GatewayOperationState";
import { MetricsCollector } from "../../../src/apps/api-gateway/middleware/metrics/MetricsCollector";

const config = { enabled: true, token: "test-management-token", prefix: "/management" };

describe("management router", () => {
  it("requires a bearer token and does not expose it in responses", async () => {
    const { createManagementRouter } = await import("../../../src/apps/api-gateway/routes/ManagementRouter");
    const state = new GatewayOperationState();
    const app = express().use(createManagementRouter(state, new MetricsCollector(new Registry()), config));

    await supertest(app).get("/v1/overview").expect(401).expect({ error: "Unauthorized" });
    const response = await supertest(app)
      .get("/v1/overview")
      .set("Authorization", "Bearer test-management-token")
      .expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).not.toContain("test-management-token");
    expect(response.body).toMatchObject({ apiVersion: 1, ready: false, routeCount: 0 });
  });

  it("rejects invalid event pagination parameters", async () => {
    const { createManagementRouter } = await import("../../../src/apps/api-gateway/routes/ManagementRouter");
    const app = express().use(createManagementRouter(new GatewayOperationState(), new MetricsCollector(new Registry()), config));

    await supertest(app)
      .get("/v1/events?limit=101")
      .set("Authorization", "Bearer test-management-token")
      .expect(400, { error: "Limit must be between 1 and 100" });
  });
});
