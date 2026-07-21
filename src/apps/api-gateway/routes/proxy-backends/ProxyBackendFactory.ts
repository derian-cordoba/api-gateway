import type { Gateway } from "../../types/gateway";
import type { CircuitBreakerMiddlewareFactory } from "../middleware-factories/CircuitBreakerMiddlewareFactory";
import type { ProxyBackend } from "./ProxyBackend";
import { LoadBalancer } from "../../middleware/load-balancer/LoadBalancer";
import { StandardProxyBackend } from "./StandardProxyBackend";
import { RetryProxyBackend } from "./RetryProxyBackend";

/**
 * Decides which `ProxyBackend` to use for a route:
 *  - Routes with `retry` → `RetryProxyBackend`
 *  - All others → `StandardProxyBackend`
 *
 * Receives the `CircuitBreakerMiddlewareFactory` so it can retrieve the
 * already-constructed `CircuitBreaker` instance (created during the middleware
 * pipeline phase) rather than constructing a second one.
 */
export class ProxyBackendFactory {
  constructor(private readonly circuitBreakerFactory: CircuitBreakerMiddlewareFactory) {}

  create(route: Gateway): ProxyBackend {
    const breaker = this.circuitBreakerFactory.getBreaker(route);
    const balancer = route.proxy.targets
      ? new LoadBalancer(route.proxy.targets, route.proxy.strategy ?? "round-robin")
      : null;

    if (route.retry) {
      return new RetryProxyBackend(route, balancer, breaker);
    }

    return new StandardProxyBackend(route, breaker, balancer);
  }
}
