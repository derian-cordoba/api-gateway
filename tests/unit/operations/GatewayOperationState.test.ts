import { describe, expect, it } from "vitest";
import { Registry } from "prom-client";
import { GatewayOperationState } from "../../../src/apps/api-gateway/operations/GatewayOperationState";
import { MetricsCollector } from "../../../src/apps/api-gateway/middleware/metrics/MetricsCollector";
import type { Gateway } from "../../../src/apps/api-gateway/types/gateway";
import { CircuitState } from "../../../src/apps/api-gateway/middleware/circuit-breaker/CircuitBreaker";

const route = {
  baseURL: "/catalog",
  proxy: { target: "http://catalog.internal" },
} as Gateway;

describe("GatewayOperationState", () => {
  it("combines active routes, metrics, and circuit state into a safe overview", async () => {
    const state = new GatewayOperationState();
    const metrics = new MetricsCollector(new Registry());
    state.setReady(true);
    state.recordRoutes([route]);
    state.recordCircuitState({
      baseURL: "/catalog",
      previousState: CircuitState.CLOSED,
      nextState: CircuitState.OPEN,
    });
    state.recordRateLimitExceeded({ baseURL: "/catalog" });
    metrics.requestsTotal.inc({ route: "/catalog", method: "GET", status_code: "200" }, 8);
    metrics.requestsTotal.inc({ route: "/catalog", method: "GET", status_code: "503" }, 2);
    metrics.requestDuration.observe({ route: "/catalog", method: "GET" }, 0.2);
    metrics.requestDuration.observe({ route: "/catalog", method: "GET" }, 0.4);
    metrics.cacheHits.inc({ route: "/catalog" }, 3);

    const overview = await state.getOverview(metrics);

    expect(overview).toMatchObject({ ready: true, routeCount: 1 });
    expect(overview.routes).toEqual([
      expect.objectContaining({
        baseURL: "/catalog",
        requestsTotal: 10,
        serverErrorsTotal: 2,
        cacheHitsTotal: 3,
        rateLimitRejectionsTotal: 1,
        circuitState: "OPEN",
      }),
    ]);
    expect(overview.routes[0].averageLatencyMs).toBeCloseTo(300);
  });

  it("returns newest events first and accepts a cursor for older events", () => {
    const state = new GatewayOperationState();
    state.recordRoutes([route]);
    state.recordRateLimitExceeded({ baseURL: "/catalog" });

    const firstPage = state.getEvents(undefined, 1);
    const secondPage = state.getEvents(firstPage.nextCursor ?? undefined, 1);

    expect(firstPage.events[0]).toMatchObject({ type: "rate-limit-exceeded", route: "/catalog" });
    expect(secondPage.events[0]).toMatchObject({ type: "route-reloaded" });
  });
});
