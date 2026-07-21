import { StatusCodes as HttpStatus } from "http-status-codes";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import { CircuitBreaker } from "../../middleware/circuit-breaker/CircuitBreaker";
import type { MiddlewareFactory } from "./MiddlewareFactory";

/**
 * Creates the circuit-breaker guard middleware for a route and caches the
 * resulting `CircuitBreaker` instance so `ProxyBackendFactory` can reuse
 * the same instance for the proxy-event plugin (no duplicate construction).
 */
export class CircuitBreakerMiddlewareFactory implements MiddlewareFactory {
  private readonly breakers = new Map<string, CircuitBreaker>();

  create(route: Gateway): RequestHandler | null {
    if (!route.circuitBreaker) return null;

    const breaker = new CircuitBreaker(route.circuitBreaker, route.baseURL);
    this.breakers.set(route.baseURL, breaker);

    return (_req: Request, res: Response, next: NextFunction) => {
      if (!breaker.shouldReject()) return next();

      res.set("Retry-After", String(breaker.retryAfterSeconds()));
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: "Service Unavailable",
        message: "Circuit breaker open — upstream is not responding",
      });
    };
  }

  /** Returns the breaker created for `route` by the most recent `create()` call, or null. */
  getBreaker(route: Gateway): CircuitBreaker | null {
    return this.breakers.get(route.baseURL) ?? null;
  }
}
