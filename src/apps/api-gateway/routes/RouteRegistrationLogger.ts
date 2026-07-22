import type { Gateway } from "../types/gateway";
import { logger } from "../logger";

/**
 * Abstracts the concern of logging route registration events away from the
 * `RouteRegistrar` orchestrator. Implementations can be swapped in tests
 * without touching routing logic.
 */
export interface RouteRegistrationLogger {
  logRegistration(route: Gateway): void;
  logWebSocketHandler(route: Gateway): void;
}

export class PinoRouteRegistrationLogger implements RouteRegistrationLogger {
  logRegistration(route: Gateway): void {
    const targets = route.proxy.targets?.map((target) => target.url) ?? [route.proxy.target!];
    const shared = {
      baseURL: route.baseURL,
      targets,
      circuitBreaker: !!route.circuitBreaker,
      timeout: route.proxy.timeout,
    };

    if (route.retry) {
      logger.info({ ...shared, retry: route.retry }, "Registered proxy route (retry enabled)");
    } else {
      logger.info(
        {
          ...shared,
          strategy: route.proxy.strategy ?? (route.proxy.targets ? "round-robin" : undefined),
          ws: !!route.proxy.ws,
          cache: !!route.cache,
        },
        "Registered proxy route",
      );
    }
  }

  logWebSocketHandler(route: Gateway): void {
    logger.info({ baseURL: route.baseURL }, "WebSocket upgrade handler registered");
  }
}
