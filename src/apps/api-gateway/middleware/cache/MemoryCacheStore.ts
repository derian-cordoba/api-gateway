import type { CacheStore } from "./CacheStore";

/**
 * Default in-process `CacheStore` implementation backed by a `Map`.
 *
 * Entries are stored with an absolute expiry timestamp (`expiresAt`). Expired
 * entries are evicted lazily on read. Optionally, a background timer can be
 * started by passing `evictionIntervalMs` to proactively remove expired entries
 * from memory — useful for routes with many unique URLs that are cached but
 * rarely re-requested.
 */
export class MemoryCacheStore<T extends { expiresAt: number }> implements CacheStore<T> {
  private readonly store = new Map<string, T>();
  private readonly evictionTimer: ReturnType<typeof setInterval> | null;

  constructor(evictionIntervalMs?: number) {
    if (evictionIntervalMs !== undefined && evictionIntervalMs > 0) {
      this.evictionTimer = setInterval(() => this.evictExpired(), evictionIntervalMs).unref();
    } else {
      this.evictionTimer = null;
    }
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, entry: T): void {
    this.store.set(key, entry);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }

  /** Stop the background eviction timer. Call during graceful shutdown. */
  dispose(): void {
    if (this.evictionTimer !== null) {
      clearInterval(this.evictionTimer);
    }
  }

  private evictExpired(): void {
    const currentTime = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= currentTime) {
        this.store.delete(key);
      }
    }
  }
}
