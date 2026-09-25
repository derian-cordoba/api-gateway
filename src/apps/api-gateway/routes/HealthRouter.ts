import { Router as ExpressRouter, type Request, type Response } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";

const startTime = Date.now();

export type HealthState = { ready: boolean };

export function createHealthRouter(state: HealthState = { ready: true }): ExpressRouter {
  const router = ExpressRouter();

  const liveness = (_req: Request, res: Response): void => {
    res.status(HttpStatus.OK).json({
      status: "ok",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || "unknown",
      timestamp: new Date().toISOString(),
    });
  };

  router.get("/health", liveness);
  router.get("/health/live", liveness);
  router.get("/health/ready", (_req: Request, res: Response) => {
    res.status(state.ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: state.ready ? "ready" : "starting",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
