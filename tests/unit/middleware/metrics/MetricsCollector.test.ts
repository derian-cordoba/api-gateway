import { describe, it, expect } from "vitest";
import { Registry } from "prom-client";
import { MetricsCollector } from "../../../../src/apps/api-gateway/middleware/metrics/MetricsCollector";

function makeCollector(): MetricsCollector {
  return new MetricsCollector(new Registry());
}

describe("MetricsCollector", () => {
  it("exposes a registry with all four metrics", async () => {
    const collector = makeCollector();
    const text = await collector.registry.metrics();
    expect(text).toContain("gateway_requests_total");
    expect(text).toContain("gateway_request_duration_seconds");
    expect(text).toContain("gateway_upstream_errors_total");
    expect(text).toContain("gateway_cache_hits_total");
  });

  it("increments requestsTotal", async () => {
    const collector = makeCollector();
    collector.requestsTotal.inc({ route: "/api", method: "GET", status_code: "200" });
    collector.requestsTotal.inc({ route: "/api", method: "GET", status_code: "200" });
    const text = await collector.registry.metrics();
    expect(text).toContain('route="/api",method="GET",status_code="200"} 2');
  });

  it("increments upstreamErrors", async () => {
    const collector = makeCollector();
    collector.upstreamErrors.inc({ route: "/api", error_type: "upstream_error" });
    const text = await collector.registry.metrics();
    expect(text).toContain('gateway_upstream_errors_total');
    expect(text).toContain("upstream_error");
  });

  it("increments cacheHits", async () => {
    const collector = makeCollector();
    collector.cacheHits.inc({ route: "/api" });
    const text = await collector.registry.metrics();
    expect(text).toContain("gateway_cache_hits_total");
  });

  it("two instances with separate registries do not interfere", async () => {
    const a = makeCollector();
    const b = makeCollector();
    a.requestsTotal.inc({ route: "/a", method: "GET", status_code: "200" });
    const textA = await a.registry.metrics();
    const textB = await b.registry.metrics();
    expect(textA).toContain('route="/a"');
    // registry B should not contain the label value from A
    expect(textB).not.toContain('route="/a",method="GET",status_code="200"} 1');
  });
});
