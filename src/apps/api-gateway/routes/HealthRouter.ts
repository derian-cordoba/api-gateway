import { Router as ExpressRouter, type Request, type Response } from "express";
import HttpStatus from "http-status";

const startTime = Date.now();

export function createHealthRouter(): ExpressRouter {
  const router = ExpressRouter();

  router.get("/health", (_req: Request, res: Response) => {
    res.status(HttpStatus.OK).json({
      status: "ok",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || "unknown",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
