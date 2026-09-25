import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";

export const TRACEPARENT_HEADER = "traceparent";
export const TRACE_ID_HEADER = "x-trace-id";

const TRACEPARENT_PATTERN = /^(\d{2})-([\da-f]{32})-([\da-f]{16})-([\da-f]{2})$/i;

/** Propagates W3C trace context without requiring a tracing vendor SDK. */
export function createTraceContextMiddleware(): RequestHandler {
  return (req, res, next): void => {
    const incoming = req.headers[TRACEPARENT_HEADER];
    const candidate = typeof incoming === "string" ? TRACEPARENT_PATTERN.exec(incoming) : null;
    const traceId = candidate?.[2] ?? randomBytes(16).toString("hex");
    const parentId = randomBytes(8).toString("hex");
    const traceparent = `00-${traceId}-${parentId}-01`;

    req.headers[TRACEPARENT_HEADER] = traceparent;
    req.headers[TRACE_ID_HEADER] = traceId;
    res.set(TRACEPARENT_HEADER, traceparent);
    res.set(TRACE_ID_HEADER, traceId);
    next();
  };
}
