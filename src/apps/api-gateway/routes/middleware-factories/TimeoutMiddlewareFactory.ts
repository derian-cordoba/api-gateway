import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import { createTimeoutMiddleware } from "../../middleware/timeout";
import type { MiddlewareFactory } from "./MiddlewareFactory";

export class TimeoutMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    if (!route.proxy.timeout) return null;
    return createTimeoutMiddleware(route.proxy.timeout);
  }
}
