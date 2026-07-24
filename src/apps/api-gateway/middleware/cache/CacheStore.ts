/**
 * Pluggable storage backend for time-bounded cache entries.
 *
 * The type parameter `T` must carry an `expiresAt` timestamp (Unix ms) so
 * that implementations can perform lazy TTL eviction without knowing anything
 * else about the entry shape.
 *
 * Implement this interface to swap the default in-process Map store for an
 * external backend (e.g. Redis, Memcached) without touching any consumer code.
 */
export interface CacheStore<T extends { expiresAt: number }> {
  /** Retrieve a cached entry by key, or `null` when absent or expired. */
  get(key: string): T | null;

  /** Persist an entry. The store is responsible for honouring the TTL. */
  set(key: string, entry: T): void;

  /** Remove all entries. */
  clear(): void;

  /** Returns the number of currently valid (non-expired) entries. */
  size(): number;
}
