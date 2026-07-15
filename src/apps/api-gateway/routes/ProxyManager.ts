import type { Router, Request, Response, NextFunction, RequestHandler } from "express";
import type { Options } from "http-proxy-middleware";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

import rateLimit from "express-rate-limit";
import { StatusCodes as HttpStatus } from "http-status-codes";
import { readFile } from "node:fs/promises";
import type { Gateway } from "../types/gateway";
import type { RateLimit } from "../types/rate-limit";
import { validateRoutes } from "./RouteValidator";
import { createAuthMiddleware } from "../middleware/authMiddleware";
import { createIpFilterMiddleware } from "../middleware/ipFilter";
import { CircuitBreaker } from "../middleware/circuit-breaker/CircuitBreaker";
import { CircuitBreakerProxyHandlers } from "../middleware/circuit-breaker/CircuitBreakerProxyHandlers";
import { logger } from "../logger";
import { appEnv } from "../config/app-env";

type ProxyOnHandlers = NonNullable<Options["on"]>;

export class ProxyManager {
  private readonly router: Router;
  private readonly filePath: string;

  constructor(router: Router) {
    this.router = router;
    this.filePath = appEnv.routes.filePath;
  }

  async registerProxyRoutes(): Promise<void> {
    const routes = await this.readRoutes();

    if (routes.length === 0) {
      logger.warn("No proxy routes configured");
      return;
    }

    routes.forEach((route) => this.registerRoute(route));
  }

  private registerRoute(route: Gateway): void {
    if (route.ipFilter) {
      this.router.use(route.baseURL, createIpFilterMiddleware(route.ipFilter));
    }

    if (route.auth) {
      this.router.use(route.baseURL, createAuthMiddleware(route.auth));
    }

    if (route.rateLimit) {
      this.router.use(route.baseURL, this.buildRateLimitMiddleware(route.rateLimit));
    }

    const breaker = route.circuitBreaker
      ? new CircuitBreaker(route.circuitBreaker, route.baseURL)
      : null;

    if (breaker) {
      this.router.use(route.baseURL, this.buildCircuitBreakerGuard(breaker));
    }

    this.router.use(route.baseURL, createProxyMiddleware(this.buildProxyOptions(route, breaker)));

    logger.info(
      { baseURL: route.baseURL, target: route.proxy.target, circuitBreaker: !!breaker },
      "Registered proxy route",
    );
  }

  private buildRateLimitMiddleware(config: RateLimit): RequestHandler {
    return rateLimit({
      windowMs: config.windowMs,
      limit: config.max,
      statusCode: config.statusCode ?? HttpStatus.TOO_MANY_REQUESTS,
      message: config.message ?? "Too many requests",
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  private buildCircuitBreakerGuard(breaker: CircuitBreaker): RequestHandler {
    return (_req: Request, res: Response, next: NextFunction) => {
      if (!breaker.shouldReject()) return next();

      res.set("Retry-After", String(breaker.retryAfterSeconds()));
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: "Service Unavailable",
        message: "Circuit breaker open — upstream is not responding",
      });
    };
  }

  private buildProxyOptions(route: Gateway, breaker: CircuitBreaker | null) {
    return { ...route.proxy, on: this.buildProxyOnHandlers(breaker) };
  }

  private buildProxyOnHandlers(breaker: CircuitBreaker | null): ProxyOnHandlers {
    const base: ProxyOnHandlers = { proxyReq: fixRequestBody };
    if (!breaker) return base;

    return { ...base, ...new CircuitBreakerProxyHandlers(breaker).toOnHandlers() };
  }

  private async readRoutes(): Promise<Gateway[]> {
    const fileRoutes = await this.readFileRoutes();
    const envRoutes = this.readEnvRoutes();

    return validateRoutes([...fileRoutes, ...envRoutes]);
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
