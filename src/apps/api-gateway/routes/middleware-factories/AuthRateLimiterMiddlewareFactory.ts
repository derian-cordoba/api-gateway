import type { RequestHandler } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { Gateway } from "../../types/gateway";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import { AuthFailureTracker } from "../../middleware/auth/AuthFailureTracker";
import { ErrorResponseFactory } from "../../middleware/ErrorResponseFactory";

/**
 * Guards auth-protected routes against brute-force attempts by tracking
 * per-IP authentication failures.
 *
 * When `auth.authRateLimit` is configured, this middleware runs BEFORE the
 * auth handler. On each 401 response the failure counter is incremented. Once
 * the counter reaches `max`, subsequent requests from the same IP are rejected
 * immediately with 429 until the `windowMs` window resets.
 *
 * The tracker is instantiated once per route and lives for the lifetime of
 * that route's middleware stack.
 */
export class AuthRateLimiterMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    if (!route.auth?.enabled || !route.auth.authRateLimit) return null;

    const { max, windowMs } = route.auth.authRateLimit;
    const tracker = new AuthFailureTracker(max, windowMs);

    return (req, res, next) => {
      const clientIp = req.ip ?? req.socket.remoteAddress ?? "unknown";

      if (tracker.isBlocked(clientIp)) {
        res
          .status(HttpStatus.TOO_MANY_REQUESTS)
          .json(ErrorResponseFactory.unauthorized("Too many failed authentication attempts — try again later"));
        return;
      }

      // Intercept res.json to detect auth failures from the auth middleware.
      const originalJson = res.json.bind(res) as typeof res.json;
      res.json = function interceptJson(body) {
        if (res.statusCode === HttpStatus.UNAUTHORIZED) {
          tracker.recordFailure(clientIp);
        }
        res.json = originalJson;
        return originalJson(body);
      };

      next();
    };
  }
}
