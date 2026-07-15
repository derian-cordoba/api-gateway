import type { Request, Response, NextFunction, RequestHandler } from "express";
import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Ensures every request carries a unique X-Request-ID header.
 *
 * - Forwards the header unchanged when the client already sent one.
 * - Generates a UUID v4 when the header is absent.
 * - Echoes the final value in the response header so callers can correlate
 *   their request with gateway and upstream logs.
 *
 * Must be registered before pino-http so that genReqId can read the header
 * and include the same ID in every log line for the request.
 */
export function createRequestIdMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req.headers[REQUEST_ID_HEADER] as string | undefined) || randomUUID();

    req.headers[REQUEST_ID_HEADER] = requestId;
    res.set(REQUEST_ID_HEADER, requestId);
    next();
  };
}
