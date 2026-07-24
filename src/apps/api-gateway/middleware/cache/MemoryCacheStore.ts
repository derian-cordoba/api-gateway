import type { CacheStore } from "./CacheStore";

/**
 * Default in-process `CacheStore` implementation backed by a `Map`.
 *
 * Entries are stored with an absolute expiry timestamp (`expiresAt`). Expired
 * entries are evicted lazily on read rather than via a background timer so
 * there are no hidden `setInterval` calls to clean up.
 */
export class MemoryCacheStore<T extends { expiresAt: number }> implements CacheStore<T> {
  private readonly store = new Map<string, T>();

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
}
