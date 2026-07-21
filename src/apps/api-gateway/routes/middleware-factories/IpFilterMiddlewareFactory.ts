import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import { createIpFilterMiddleware } from "../../middleware/ipFilter";
import type { MiddlewareFactory } from "./MiddlewareFactory";

export class IpFilterMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    if (!route.ipFilter) return null;
    return createIpFilterMiddleware(route.ipFilter);
  }
}
