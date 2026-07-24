import { Registry, Counter, Histogram } from "prom-client";
import { appEnv } from "../../config/app-env";

export class MetricsCollector {
  readonly registry: Registry;

  readonly requestsTotal: Counter<"route" | "method" | "status_code">;
  readonly requestDuration: Histogram<"route" | "method">;
  readonly upstreamErrors: Counter<"route" | "error_type">;
  readonly cacheHits: Counter<"route">;

  constructor(registry?: Registry) {
    this.registry = registry ?? new Registry();

    this.requestsTotal = new Counter({
      name: "gateway_requests_total",
      help: "Total number of requests proxied by the gateway",
      labelNames: ["route", "method", "status_code"],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: "gateway_request_duration_seconds",
      help: "Duration of gateway requests in seconds",
      labelNames: ["route", "method"],
      buckets: appEnv.proxy.metricsHistogramBuckets,
      registers: [this.registry],
    });

    this.upstreamErrors = new Counter({
      name: "gateway_upstream_errors_total",
      help: "Total number of upstream errors (5xx or network failures)",
      labelNames: ["route", "error_type"],
      registers: [this.registry],
    });

    this.cacheHits = new Counter({
      name: "gateway_cache_hits_total",
      help: "Total number of cache hits served without proxying",
      labelNames: ["route"],
      registers: [this.registry],
    });
  }
}

/** Module-level singleton — persists across ProxyManager.build() reloads. */
export const metricsCollector = new MetricsCollector();
