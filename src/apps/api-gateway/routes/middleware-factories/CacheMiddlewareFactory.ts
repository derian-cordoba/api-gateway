import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import { ResponseCache } from "../../middleware/cache/ResponseCache";
import { createCacheMiddleware } from "../../middleware/cache/createCacheMiddleware";
import type { MiddlewareFactory } from "./MiddlewareFactory";

export class CacheMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    if (!route.cache) return null;
    const cache = new ResponseCache(route.cache);
    return createCacheMiddleware(cache);
  }
}
