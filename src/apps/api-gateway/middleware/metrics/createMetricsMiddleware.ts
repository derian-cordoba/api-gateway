import type { RequestHandler, Request, Response, NextFunction } from "express";
import type { MetricsCollector } from "./MetricsCollector";

/**
 * Returns per-route middleware that records request counts, latency, upstream
 * errors, and cache hits into the provided MetricsCollector.
 *
 * Must be placed BEFORE the cache middleware so that cache hits are still
 * counted — the cache middleware adds `X-Cache: HIT` before calling next,
 * but with the cache middleware intercepting `res.end`, we detect hits via
 * the `X-Cache` response header on `finish`.
 */
export function createMetricsMiddleware(
  route: string,
  collector: MetricsCollector,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const end = collector.requestDuration.startTimer({ route, method: req.method });

    res.on("finish", () => {
      const status = String(res.statusCode);
      collector.requestsTotal.inc({ route, method: req.method, status_code: status });
      end();

      if (res.statusCode >= 500) {
        collector.upstreamErrors.inc({ route, error_type: "upstream_error" });
      }

      if (res.getHeader("X-Cache") === "HIT") {
        collector.cacheHits.inc({ route });
      }
    });

    next();
  };
}
