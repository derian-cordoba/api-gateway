import type { Router } from "express";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Options } from "http-proxy-middleware";
import { validateRoutes } from "./RouteValidator";
import { CompositeRouteSource } from "./route-sources/CompositeRouteSource";
import { FileRouteSource } from "./route-sources/FileRouteSource";
import { EnvRouteSource } from "./route-sources/EnvRouteSource";
import { RouteRegistrar } from "./RouteRegistrar";
import { CorsMiddlewareFactory } from "./middleware-factories/CorsMiddlewareFactory";
import { IpFilterMiddlewareFactory } from "./middleware-factories/IpFilterMiddlewareFactory";
import { AuthMiddlewareFactory } from "./middleware-factories/AuthMiddlewareFactory";
import { RateLimitMiddlewareFactory } from "./middleware-factories/RateLimitMiddlewareFactory";
import { CircuitBreakerMiddlewareFactory } from "./middleware-factories/CircuitBreakerMiddlewareFactory";
import { MetricsMiddlewareFactory } from "./middleware-factories/MetricsMiddlewareFactory";
import { CacheMiddlewareFactory } from "./middleware-factories/CacheMiddlewareFactory";
import { TimeoutMiddlewareFactory } from "./middleware-factories/TimeoutMiddlewareFactory";
import { ProxyBackendFactory } from "./proxy-backends/ProxyBackendFactory";
import { metricsCollector } from "../middleware/metrics/MetricsCollector";
import { logger } from "../logger";
import { appEnv } from "../config/app-env";

export type ProxyOnHandlers = NonNullable<Options["on"]>;
export type WsUpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export class ProxyManager {
  private readonly sources: CompositeRouteSource;
  private readonly registrar: RouteRegistrar;

  constructor(router: Router) {
    const circuitBreakerFactory = new CircuitBreakerMiddlewareFactory();

    this.sources = new CompositeRouteSource([
      new FileRouteSource(appEnv.routes.filePath),
      new EnvRouteSource(),
    ]);

    this.registrar = new RouteRegistrar(
      router,
      [
        new CorsMiddlewareFactory(),
        new IpFilterMiddlewareFactory(),
        new AuthMiddlewareFactory(),
        new RateLimitMiddlewareFactory(),
        circuitBreakerFactory,
        new MetricsMiddlewareFactory(metricsCollector),
        new CacheMiddlewareFactory(),
        new TimeoutMiddlewareFactory(),
      ],
      new ProxyBackendFactory(circuitBreakerFactory),
    );
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
    const raw = await this.sources.load();
    const routes = validateRoutes(raw);

    if (routes.length === 0) {
      logger.warn("No proxy routes configured");
      return [];
    }

    return routes.flatMap((route) => {
      const handler = this.registrar.register(route);
      return handler ? [handler] : [];
    });
  }
}
