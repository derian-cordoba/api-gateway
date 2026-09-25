import type { AsyncCacheStore } from "../redis/RedisCacheStore";
import type { CacheEntry, CacheEntryWithStaleness, CacheOptions } from "./ResponseCache";
import { appEnv } from "../../config/app-env";

/** Cache policy backed by an asynchronous store such as Redis. */
export class AsyncResponseCache {
  private readonly methods: Set<string>;
  private readonly statusCodes: Set<number>;

  constructor(
    private readonly options: CacheOptions,
    private readonly store: AsyncCacheStore<CacheEntry>,
  ) {
    this.methods = new Set((options.methods ?? appEnv.proxy.cacheDefaultMethods).map((method) => method.toUpperCase()));
    this.statusCodes = new Set(options.statusCodes ?? appEnv.proxy.cacheDefaultStatusCodes);
  }

  isCacheable(method: string, statusCode: number): boolean {
    return this.methods.has(method.toUpperCase()) && this.statusCodes.has(statusCode);
  }

  async getWithStaleness(key: string): Promise<CacheEntryWithStaleness | null> {
    const entry = await this.store.get(key);
    if (!entry) return null;
    return { entry, isStale: Date.now() > entry.freshUntil };
  }

  async markRefreshing(key: string): Promise<void> {
    const entry = await this.store.get(key);
    if (entry) {
      await this.store.set(key, { ...entry, refreshingAt: Date.now() });
    }
  }

  async set(key: string, entry: Omit<CacheEntry, "expiresAt" | "freshUntil" | "refreshingAt">): Promise<void> {
    const freshUntil = Date.now() + this.options.ttl;
    await this.store.set(key, {
      ...entry,
      freshUntil,
      expiresAt: freshUntil + (this.options.staleWhileRevalidateMs ?? 0),
    });
  }
}
