import { Router as ExpressRouter, type Request, type Response } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import { appEnv } from "../config/app-env";
import type { ManagementConfig } from "../config/admin/config";
import { timingSafeStringEqual } from "../../../shared/security/timingSafeStringEqual";
import type { GatewayOperationState } from "../operations/GatewayOperationState";
import type { MetricsCollector } from "../middleware/metrics/MetricsCollector";

export function createManagementRouter(
  state: GatewayOperationState,
  metrics: MetricsCollector,
  config: ManagementConfig = appEnv.management,
): ExpressRouter {
  const router = ExpressRouter();
  router.use(authorizeManagementRequest(config));
  router.get("/v1/capabilities", (_req, res) => {
    res.set("Cache-Control", "no-store").json({ apiVersion: 1, features: ["overview", "events"] });
  });
  router.get("/v1/overview", async (_req, res, next) => {
    try {
      res.set("Cache-Control", "no-store").json(await state.getOverview(metrics));
    } catch (error) {
      next(error);
    }
  });
  router.get("/v1/events", (req, res) => {
    const limit = parseLimit(req, res);
    if (limit === null) {
      return;
    }

    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const route = typeof req.query.route === "string" ? req.query.route : undefined;

    if (cursor !== undefined && !/^\d+$/.test(cursor)) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: "Invalid cursor" });
      return;
    }

    if (route !== undefined && (route.length > 512 || !route.startsWith("/"))) {
      res.status(HttpStatus.BAD_REQUEST).json({ error: "Invalid route" });
      return;
    }

    res.set("Cache-Control", "no-store").json(state.getEvents(cursor, limit, route));
  });
  return router;
}

function authorizeManagementRequest(config: ManagementConfig) {
  return (req: Request, res: Response, next: () => void): void => {
    const bearer = req.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!config.token || !bearer || !timingSafeStringEqual(bearer, config.token)) {
      res.status(HttpStatus.UNAUTHORIZED).set("Cache-Control", "no-store").json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}

function parseLimit(req: Request, res: Response): number | null {
  const raw = req.query.limit;
  if (raw === undefined) return 50;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    res.status(HttpStatus.BAD_REQUEST).json({ error: "Invalid limit" });
    return null;
  }
  const limit = Number(raw);
  if (limit < 1 || limit > 100) {
    res.status(HttpStatus.BAD_REQUEST).json({ error: "Limit must be between 1 and 100" });
    return null;
  }
  return limit;
}
