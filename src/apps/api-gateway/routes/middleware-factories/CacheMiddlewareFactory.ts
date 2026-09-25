import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import { MemoryCacheStore } from "../../middleware/cache/MemoryCacheStore";
import { ResponseCache } from "../../middleware/cache/ResponseCache";
import { createCacheMiddleware } from "../../middleware/cache/createCacheMiddleware";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import type { CacheEntry } from "../../middleware/cache/ResponseCache";
import type { AsyncCacheStore } from "../../middleware/redis/RedisCacheStore";
import { AsyncResponseCache } from "../../middleware/cache/AsyncResponseCache";
import { createAsyncCacheMiddleware } from "../../middleware/cache/createCacheMiddleware";

export class CacheMiddlewareFactory implements MiddlewareFactory {
  private readonly stores = new Set<MemoryCacheStore<CacheEntry>>();

  constructor(
    private readonly storeFactory?: (route: Gateway) => AsyncCacheStore<CacheEntry>,
  ) { }

  create(route: Gateway): RequestHandler | null {
    if (!route.cache) return null;

    if (this.storeFactory) {
      const store = this.storeFactory(route);
      return createAsyncCacheMiddleware(new AsyncResponseCache(route.cache, store));
    }

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
