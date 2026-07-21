import type { Router } from "express";
import type { Gateway } from "../types/gateway";
import type { MiddlewareFactory } from "./middleware-factories/MiddlewareFactory";
import type { ProxyBackendFactory } from "./proxy-backends/ProxyBackendFactory";
import type { WsUpgradeHandler } from "./ProxyManager";
import { logger } from "../logger";

/**
 * Mounts a single route onto an Express router by running the route config
 * through an ordered `MiddlewareFactory[]` pipeline and then attaching the
 * appropriate proxy backend.
 *
 * Each factory returns either a `RequestHandler` or `null` — `null` means
 * "nothing to contribute for this route" and is skipped cleanly without
 * mounting a no-op handler.
 */
export class RouteRegistrar {
  constructor(
    private readonly router: Router,
    private readonly middlewarePipeline: MiddlewareFactory[],
    private readonly backendFactory: ProxyBackendFactory,
  ) {}

  register(route: Gateway): WsUpgradeHandler | null {
    for (const factory of this.middlewarePipeline) {
      const middleware = factory.create(route);
      if (middleware) this.router.use(route.baseURL, middleware);
    }

    const backend = this.backendFactory.create(route);
    this.router.use(route.baseURL, backend.createMiddleware());
    const wsHandler = backend.wsUpgradeHandler();

    if (route.retry) {
      logger.info(
        {
          baseURL: route.baseURL,
          targets: route.proxy.targets?.map((target) => target.url) ?? [route.proxy.target!],
          retry: route.retry,
          circuitBreaker: !!route.circuitBreaker,
          timeout: route.proxy.timeout,
        },
        "Registered proxy route (retry enabled)",
      );
    } else {
      logger.info(
        {
          baseURL: route.baseURL,
          targets: route.proxy.targets?.map((target) => target.url) ?? [route.proxy.target!],
          strategy: route.proxy.strategy ?? (route.proxy.targets ? "round-robin" : undefined),
          circuitBreaker: !!route.circuitBreaker,
          timeout: route.proxy.timeout,
          ws: !!route.proxy.ws,
          cache: !!route.cache,
        },
        "Registered proxy route",
      );
    }

    if (wsHandler) {
      logger.info({ baseURL: route.baseURL }, "WebSocket upgrade handler registered");
    }

    return wsHandler;
  }
}
