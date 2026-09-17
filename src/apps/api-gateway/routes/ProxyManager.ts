import type { Router } from "express";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Options } from "http-proxy-middleware";
import type { Gateway } from "../types/gateway";
import type { MiddlewareFactory } from "./middleware-factories/MiddlewareFactory";
import { validateRoutes } from "./RouteValidator";
import { CompositeRouteSource } from "./route-sources/CompositeRouteSource";
import { FileRouteSource } from "./route-sources/FileRouteSource";
import { EnvRouteSource } from "./route-sources/EnvRouteSource";
import { RouteRegistrar } from "./RouteRegistrar";
import { CorsMiddlewareFactory } from "./middleware-factories/CorsMiddlewareFactory";
import { IpFilterMiddlewareFactory } from "./middleware-factories/IpFilterMiddlewareFactory";
import { BodyValidationMiddlewareFactory } from "./middleware-factories/BodyValidationMiddlewareFactory";
import { WebhookMiddlewareFactory } from "./middleware-factories/WebhookMiddlewareFactory";
import { AuthRateLimiterMiddlewareFactory } from "./middleware-factories/AuthRateLimiterMiddlewareFactory";
import { AuthMiddlewareFactory } from "./middleware-factories/AuthMiddlewareFactory";
import { RateLimitMiddlewareFactory } from "./middleware-factories/RateLimitMiddlewareFactory";
import { CircuitBreakerMiddlewareFactory } from "./middleware-factories/CircuitBreakerMiddlewareFactory";
import { MetricsMiddlewareFactory } from "./middleware-factories/MetricsMiddlewareFactory";
import { CacheMiddlewareFactory } from "./middleware-factories/CacheMiddlewareFactory";
import { TimeoutMiddlewareFactory } from "./middleware-factories/TimeoutMiddlewareFactory";
import { ProxyBackendFactory } from "./proxy-backends/ProxyBackendFactory";
import { PinoRouteRegistrationLogger } from "./RouteRegistrationLogger";
import { metricsCollector } from "../middleware/metrics/MetricsCollector";
import { logger } from "../logger";
import { appEnv } from "../config/app-env";

export type ProxyOnHandlers = NonNullable<Options["on"]>;
export type WsUpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export type ProxyBuildResult = {
  router: Router;
  wsHandlers: WsUpgradeHandler[];
  routes: readonly Gateway[];
};

export type RouteRegistrationResult = {
  wsHandlers: WsUpgradeHandler[];
  routes: readonly Gateway[];
};

export class ProxyManager {
  private constructor(
    private readonly sources: CompositeRouteSource,
    private readonly registrar: RouteRegistrar,
  ) {}

  /**
   * Constructs a fully-wired ProxyManager with the default middleware pipeline.
   *
   * Middleware execution order (per request):
   *  1. CORS           — preflight handling and cross-origin headers
   *  2. IP Filter      — early rejection of blocked / non-allowlisted IPs
   *  3. Body Validation — content-type, size, and required-field checks
   *  4. Webhook        — HMAC signature verification for inbound webhook calls
   *  5. Auth Rate Limiter — track and block IPs with repeated auth failures
   *  6. Auth           — JWT / API key / Basic / OAuth2 token verification
   *  7. Rate Limiter   — per-route request quota enforcement
   *  8. Circuit Breaker — fail-fast when upstream is unhealthy
   *  9. Metrics        — Prometheus counters and histograms
   * 10. Cache          — serve from memory on cache hits
   * 11. Timeout        — abort slow upstream requests
   * 12. Proxy backend  — forward request to upstream
   */
  static create(router: Router): ProxyManager {
    const circuitBreakerFactory = new CircuitBreakerMiddlewareFactory();

    const middlewareFactories: MiddlewareFactory[] = [
      new CorsMiddlewareFactory(),
      new IpFilterMiddlewareFactory(),
      new BodyValidationMiddlewareFactory(),
      new WebhookMiddlewareFactory(),
      new AuthRateLimiterMiddlewareFactory(),
      new AuthMiddlewareFactory(),
      new RateLimitMiddlewareFactory(),
      circuitBreakerFactory,
      new MetricsMiddlewareFactory(metricsCollector),
      new CacheMiddlewareFactory(),
      new TimeoutMiddlewareFactory(),
    ];

    const sources = new CompositeRouteSource([
      new FileRouteSource(appEnv.routes.filePath),
      new EnvRouteSource(),
    ]);

    const registrar = new RouteRegistrar(
      router,
      middlewareFactories,
      new ProxyBackendFactory(circuitBreakerFactory),
      new PinoRouteRegistrationLogger(),
    );

    return new ProxyManager(sources, registrar);
  }

  /**
   * Build a fully-configured router and collect any WebSocket upgrade handlers.
   * Called on every reload — each invocation is independent with no shared state.
   * Also returns the validated route list so callers can react to route changes.
   */
  static async build(router: Router): Promise<ProxyBuildResult> {
    const manager = ProxyManager.create(router);
    const { wsHandlers, routes } = await manager.registerProxyRoutes();
    return { router, wsHandlers, routes };
  }

  async registerProxyRoutes(): Promise<RouteRegistrationResult> {
    const raw = await this.sources.load();
    const routes = validateRoutes(raw);

    if (routes.length === 0) {
      logger.warn("No proxy routes configured");
      return { wsHandlers: [], routes };
    }

    const wsHandlers = routes.flatMap((route) => {
      const handler = this.registrar.register(route);
      return handler ? [handler] : [];
    });

    return { wsHandlers, routes };
  }
}
