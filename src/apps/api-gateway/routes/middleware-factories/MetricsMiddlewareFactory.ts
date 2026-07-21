import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { MetricsCollector } from "../../middleware/metrics/MetricsCollector";
import { createMetricsMiddleware } from "../../middleware/metrics/createMetricsMiddleware";
import type { MiddlewareFactory } from "./MiddlewareFactory";

export class MetricsMiddlewareFactory implements MiddlewareFactory {
  constructor(private readonly collector: MetricsCollector) {}

  create(route: Gateway): RequestHandler | null {
    return createMetricsMiddleware(route.baseURL, this.collector);
  }
}
