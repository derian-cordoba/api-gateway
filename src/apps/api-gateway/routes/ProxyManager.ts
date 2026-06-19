import type { Router } from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import rateLimit from "express-rate-limit";
import { StatusCodes as HttpStatus } from "http-status-codes";
import { readFile } from "node:fs/promises";
import type { Gateway } from "../types/gateway";
import { validateRoutes } from "./RouteValidator";
import { logger } from "../logger";
import { appEnv } from "../config/app-env";

export class ProxyManager {
  private readonly router: Router;
  private readonly filePath: string;

  constructor(router: Router) {
    this.router = router;
    this.filePath = appEnv.routes.filePath;
  }

  /**
   * Register all proxy routes in the application
   */
  async registerProxyRoutes(): Promise<void> {
    const routes: Gateway[] = await this.readRoutes();

    if (routes.length === 0) {
      logger.warn("No proxy routes configured");
      return;
    }

    routes.forEach((route: Gateway) => {
      // Apply per-route rate limiting when configured
      if (route.rateLimit) {
        this.router.use(
          route.baseURL,
          rateLimit({
            windowMs: route.rateLimit.windowMs,
            limit: route.rateLimit.max,
            statusCode: route.rateLimit.statusCode ?? HttpStatus.TOO_MANY_REQUESTS,
            message: route.rateLimit.message ?? "Too many requests",
            standardHeaders: true,
            legacyHeaders: false,
          })
        );
      }

      this.router.use(
        route.baseURL,
        createProxyMiddleware({
          ...route.proxy,
          on: {
            // Re-stream the body that express.json() already consumed so the
            // upstream receives the request body correctly on POST/PUT/PATCH.
            proxyReq: fixRequestBody,
          },
        })
      );
      logger.info({ baseURL: route.baseURL, target: route.proxy.target }, "Registered proxy route");
    });
  }

  private async readRoutes(): Promise<Gateway[]> {
    const fileRoutes = await this.readFileRoutes();
    const envRoutes = this.readEnvRoutes();
    const merged = [...fileRoutes, ...envRoutes];

    return validateRoutes(merged);
  }

  private async readFileRoutes(): Promise<unknown[]> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return JSON.parse(content) as unknown[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.debug({ filePath: this.filePath }, "Routes file not found, skipping");
        return [];
      }
      logger.error({ err: error, filePath: this.filePath }, "Failed to read routes file");
      return [];
    }
  }

  private readEnvRoutes(): unknown[] {
    const raw = process.env.ROUTES;
    if (!raw) return [];

    try {
      return JSON.parse(raw) as unknown[];
    } catch (error) {
      logger.error({ err: error }, "Failed to parse ROUTES env var as JSON, skipping");
      return [];
    }
  }
}
