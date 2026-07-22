import type { Router } from "express";
import type { Gateway } from "../types/gateway";
import type { MiddlewareFactory } from "./middleware-factories/MiddlewareFactory";
import type { ProxyBackendFactory } from "./proxy-backends/ProxyBackendFactory";
import type { RouteRegistrationLogger } from "./RouteRegistrationLogger";
import type { WsUpgradeHandler } from "./ProxyManager";

/**
 * Mounts a single route onto an Express router by running the route config
 * through an ordered `MiddlewareFactory[]` pipeline and then attaching the
 * appropriate proxy backend.
 *
 * Each factory returns either a `RequestHandler` or `null` — `null` means
 * "nothing to contribute for this route" and is skipped cleanly without
 * mounting a no-op handler.
 *
 * Logging is delegated to `RouteRegistrationLogger` so this class stays
 * focused on routing (Single Responsibility Principle).
 */
export class RouteRegistrar {
  constructor(
    private readonly router: Router,
    private readonly middlewarePipeline: MiddlewareFactory[],
    private readonly backendFactory: ProxyBackendFactory,
    private readonly registrationLogger: RouteRegistrationLogger,
  ) {}

  register(route: Gateway): WsUpgradeHandler | null {
    for (const factory of this.middlewarePipeline) {
      const middleware = factory.create(route);
      if (middleware) this.router.use(route.baseURL, middleware);
    }

    const backend = this.backendFactory.create(route);
    this.router.use(route.baseURL, backend.createMiddleware());
    const wsHandler = backend.wsUpgradeHandler();

    this.registrationLogger.logRegistration(route);
    if (wsHandler) this.registrationLogger.logWebSocketHandler(route);

    return wsHandler;
  }
}
