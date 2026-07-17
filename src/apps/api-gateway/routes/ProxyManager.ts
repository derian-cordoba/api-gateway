import type { Router, Request, Response, NextFunction, RequestHandler } from "express";
import type { Options } from "http-proxy-middleware";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";

import rateLimit from "express-rate-limit";
import { StatusCodes as HttpStatus } from "http-status-codes";
import { readFile } from "node:fs/promises";
import type { Gateway } from "../types/gateway";
import type { RateLimit } from "../types/rate-limit";
import { validateRoutes } from "./RouteValidator";
import { createAuthMiddleware } from "../middleware/authMiddleware";
import { createIpFilterMiddleware } from "../middleware/ipFilter";
import { createTimeoutMiddleware } from "../middleware/timeout";
import { CircuitBreaker } from "../middleware/circuit-breaker/CircuitBreaker";
import { CircuitBreakerProxyHandlers } from "../middleware/circuit-breaker/CircuitBreakerProxyHandlers";
import { LoadBalancer } from "../middleware/load-balancer/LoadBalancer";
import { logger } from "../logger";
import { appEnv } from "../config/app-env";

export type ProxyOnHandlers = NonNullable<Options["on"]>;
export type WsUpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export class ProxyManager {
  private readonly router: Router;
  private readonly filePath: string;

  constructor(router: Router) {
    this.router = router;
    this.filePath = appEnv.routes.filePath;
  }

  /**
   * Build a fully-configured router and collect any WebSocket upgrade handlers.
   * Called on every reload — each invocation is independent with no shared state.
   */
  static async build(router: Router): Promise<{ router: Router; wsHandlers: WsUpgradeHandler[] }> {
    const manager = new ProxyManager(router);
    const wsHandlers = await manager.registerProxyRoutes();
    return { router, wsHandlers };
  }

  async registerProxyRoutes(): Promise<WsUpgradeHandler[]> {
    const routes = await this.readRoutes();
    const wsHandlers: WsUpgradeHandler[] = [];

    if (routes.length === 0) {
      logger.warn("No proxy routes configured");
      return wsHandlers;
    }

    routes.forEach((route) => {
      const handler = this.registerRoute(route);
      if (handler) wsHandlers.push(handler);
    });

    return wsHandlers;
  }

  private registerRoute(route: Gateway): WsUpgradeHandler | null {
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

    // Register timeout middleware before the proxy so it can send 504 if the
    // upstream is slow. The timer is cleared automatically when the response
    // finishes normally.
    if (route.proxy.timeout) {
      this.router.use(route.baseURL, createTimeoutMiddleware(route.proxy.timeout));
    }

    const balancer = route.proxy.targets
      ? new LoadBalancer(route.proxy.targets, route.proxy.strategy ?? "round-robin")
      : null;

    const proxyMiddleware = createProxyMiddleware(this.buildProxyOptions(route, breaker, balancer));

    this.router.use(route.baseURL, proxyMiddleware);

    logger.info(
      {
        baseURL: route.baseURL,
        targets: route.proxy.targets?.map((t) => t.url) ?? [route.proxy.target!],
        strategy: route.proxy.strategy ?? (route.proxy.targets ? "round-robin" : undefined),
        circuitBreaker: !!breaker,
        timeout: route.proxy.timeout,
        ws: !!route.proxy.ws,
      },
      "Registered proxy route",
    );

    if (route.proxy.ws) {
      logger.info({ baseURL: route.baseURL }, "WebSocket upgrade handler registered");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (proxyMiddleware as any).upgrade as WsUpgradeHandler;
    }

    return null;
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

  private buildProxyOptions(
    route: Gateway,
    breaker: CircuitBreaker | null,
    balancer: LoadBalancer | null,
  ): Options {
    // Extract fields handled outside of http-proxy-middleware so they don't
    // get passed through as unknown proxy options.
    const { target, targets, strategy, timeout, ...proxyRest } = route.proxy;

    void targets;
    void strategy;

    const options: Options = {
      ...proxyRest,
      on: this.buildProxyOnHandlers(breaker, balancer),
    };

    // Use proxyTimeout (max wait for upstream response) rather than timeout
    // (socket inactivity). The timeout middleware already handles sending 504;
    // proxyTimeout ensures the upstream connection is also aborted.
    if (timeout !== undefined) {
      options.proxyTimeout = timeout;
    }

    if (balancer) {
      options.router = balancer.createRouterFn();
    } else {
      options.target = target;
    }

    return options;
  }

  private buildProxyOnHandlers(
    breaker: CircuitBreaker | null,
    balancer: LoadBalancer | null,
  ): ProxyOnHandlers {
    const handlers: ProxyOnHandlers = { proxyReq: fixRequestBody };

    const cbHandlers = breaker ? new CircuitBreakerProxyHandlers(breaker).toOnHandlers() : null;

    if (cbHandlers) {
      handlers.proxyRes = cbHandlers.proxyRes;
      handlers.error = cbHandlers.error;
    }

    if (balancer) {
      const prevProxyRes = handlers.proxyRes;
      const prevError = handlers.error;

      handlers.proxyRes = (proxyRes, req, res) => {
        if (prevProxyRes) prevProxyRes(proxyRes, req, res);
        balancer.onConnectionClosed(req);
      };

      handlers.error = (err, req, res) => {
        // The timeout middleware may have already sent a 504; skip writing again.
        if ((res as { headersSent?: boolean }).headersSent) {
          balancer.onConnectionClosed(req);
          return;
        }
        if (prevError) prevError(err, req, res);
        balancer.onConnectionClosed(req);
      };
    }

    return handlers;
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
      // Re-throw so callers (e.g. RouteReloader) can catch and keep the last good config
      throw error;
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
