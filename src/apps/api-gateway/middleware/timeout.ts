import type { RequestHandler } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";

/**
 * Returns Express middleware that sends 504 Gateway Timeout if the upstream
 * does not respond within `ms` milliseconds.
 *
 * The timer is cleared as soon as the response finishes or the socket closes,
 * so fast upstreams incur no overhead beyond registering two event listeners.
 */
export function createTimeoutMiddleware(ms: number): RequestHandler {
  return (_, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(HttpStatus.GATEWAY_TIMEOUT).json({
          error: "Gateway Timeout",
          message: `Upstream did not respond within ${ms}ms`,
        });
      }
    }, ms);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
