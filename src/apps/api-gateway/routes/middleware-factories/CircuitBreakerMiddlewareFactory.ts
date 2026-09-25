import { StatusCodes as HttpStatus } from "http-status-codes";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import { CircuitBreaker } from "../../middleware/circuit-breaker/CircuitBreaker";
import { HealthProber } from "../../middleware/circuit-breaker/HealthProber";
import { ErrorResponseFactory } from "../../middleware/ErrorResponseFactory";
import { AsyncStateCircuitBreaker } from "../../middleware/circuit-breaker/AsyncStateCircuitBreaker";
import type { AsyncCircuitBreakerStateStore } from "../../middleware/redis/RedisCircuitBreakerStateStore";

/**
 * Creates the circuit-breaker guard middleware for a route and caches the
 * resulting `CircuitBreaker` instance so `ProxyBackendFactory` can reuse
 * the same instance for the proxy-event plugin (no duplicate construction).
 *
 * When `healthCheck` is configured, a `HealthProber` is started to actively
 * probe the upstream while the circuit is open.
 */
export class CircuitBreakerMiddlewareFactory implements MiddlewareFactory {
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly targetBreakers = new Map<string, ReadonlyMap<string, CircuitBreaker>>();
  private readonly probers = new Map<string, HealthProber>();

  constructor(
    private readonly storeFactory?: (route: Gateway) => AsyncCircuitBreakerStateStore,
  ) { }

  create(route: Gateway): RequestHandler | null {
    if (!route.circuitBreaker) return null;

    const breaker = this.storeFactory
      ? new AsyncStateCircuitBreaker(route.circuitBreaker, route.baseURL, this.storeFactory(route))
      : new CircuitBreaker(route.circuitBreaker, route.baseURL);
    this.breakers.set(route.baseURL, breaker);
    if (route.proxy.targets) {
      const perTarget = new Map(
        route.proxy.targets.map((target) => [
          target.url,
          new CircuitBreaker(route.circuitBreaker!, `${route.baseURL}:${target.url}`),
        ] as const),
      );
      this.targetBreakers.set(route.baseURL, perTarget);
    }

    if (route.circuitBreaker.healthCheck) {
      const prober = new HealthProber(breaker, route.circuitBreaker.healthCheck);
      prober.start();
      this.probers.set(route.baseURL, prober);
    }

    return async (_req: Request, res: Response, next: NextFunction) => {
      if (!await breaker.shouldRejectAsync()) return next();

      const retryAfterSeconds = breaker.retryAfterSeconds();
      res.set("Retry-After", String(retryAfterSeconds));

      const fallback = route.circuitBreaker?.fallback;
      if (fallback) {
        const responseStatus = fallback.status ?? HttpStatus.SERVICE_UNAVAILABLE;
        if (fallback.headers) {
          for (const [headerName, headerValue] of Object.entries(fallback.headers)) {
            res.set(headerName, headerValue);
          }
        }
        if (fallback.body !== undefined) {
          res.status(responseStatus).json(fallback.body);
        } else {
          res.status(responseStatus).end();
        }
        return;
      }

      res.status(HttpStatus.SERVICE_UNAVAILABLE).json(ErrorResponseFactory.circuitOpen());
    };
  }

  /** Returns the breaker created for `route` by the most recent `create()` call, or null. */
  getBreaker(route: Gateway): CircuitBreaker | null {
    return this.breakers.get(route.baseURL) ?? null;
  }

  getTargetBreakers(route: Gateway): ReadonlyMap<string, CircuitBreaker> | null {
    return this.targetBreakers.get(route.baseURL) ?? null;
  }

  /** Stop all active health probers. Call during hot-reload to clean up timers. */
  stopProbers(): void {
    for (const prober of this.probers.values()) {
      prober.stop();
    }
    this.probers.clear();
    this.targetBreakers.clear();
    this.breakers.clear();
  }
}
