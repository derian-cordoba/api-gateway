import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import { MemoryCacheStore } from "../../middleware/cache/MemoryCacheStore";
import { ResponseCache } from "../../middleware/cache/ResponseCache";
import { createCacheMiddleware } from "../../middleware/cache/createCacheMiddleware";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import type { CacheEntry } from "../../middleware/cache/ResponseCache";

export class CacheMiddlewareFactory implements MiddlewareFactory {
  private readonly stores = new Set<MemoryCacheStore<CacheEntry>>();

  create(route: Gateway): RequestHandler | null {
    if (!route.cache) return null;

    const store = new MemoryCacheStore<CacheEntry>(route.cache.evictionIntervalMs);
    this.stores.add(store);

    const cache = new ResponseCache({
      ...route.cache,
      store,
      staleWhileRevalidateMs: route.cache.staleWhileRevalidateMs,
    });

    return createCacheMiddleware(cache);
  }

  dispose(): void {
    for (const store of this.stores) {
      store.dispose();
    }
    this.stores.clear();
  }
}
