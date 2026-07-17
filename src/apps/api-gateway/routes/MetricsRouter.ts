import { Router as ExpressRouter, type Request, type Response } from "express";
import type { MetricsCollector } from "../middleware/metrics/MetricsCollector";

export function createMetricsRouter(collector: MetricsCollector): ExpressRouter {
  const router = ExpressRouter();

  router.get("/metrics", async (_req: Request, res: Response) => {
    const metrics = await collector.registry.metrics();
    res.set("Content-Type", collector.registry.contentType);
    res.end(metrics);
  });

  return router;
}
