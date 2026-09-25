/**
 * Minimal Redis client interface required by RedisCacheStore.
 * Compatible with ioredis and node-redis clients — users install the Redis
 * package of their choice separately; no hard dependency is introduced here.
 */
export interface RedisClientAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: "PXAT", expiresAt: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

/**
 * Async `CacheStore`-compatible interface whose methods return `Promise`s.
 *
 * The built-in `CacheStore<T>` interface declares synchronous method
 * signatures. Because Redis I/O is inherently asynchronous this store cannot
 * implement that interface directly without lying to the type-checker. Instead
 * it exposes the same method names with `Promise`-wrapped return types.
 * Callers must `await` every call.
 */
export interface AsyncCacheStore<T extends { expiresAt: number }> {
  get(key: string): Promise<T | null>;
  set(key: string, entry: T): Promise<void>;
  clear(): Promise<void>;
  size(): number;
}

/**
 * Redis-backed implementation of `AsyncCacheStore`.
 *
 * Because Redis operations are inherently asynchronous, the methods `get`,
 * `set`, and `clear` return `Promise`s. The `CacheStore` interface declares
 * synchronous signatures, so this class implements the async-compatible
 * `AsyncCacheStore` supertype instead. Callers must `await` these methods.
 *
 * TTL is enforced at the Redis layer via `PXAT` (expire-at-milliseconds), and
 * also lazily client-side: if a stored entry has already passed its
 * `expiresAt` timestamp when retrieved, it is deleted and `null` is returned.
 *
 * @example
 * ```ts
 * import Redis from "ioredis";
 * const store = new RedisCacheStore(new Redis(), "my-cache:");
 * await store.set("route-/api/users", { data: [...], expiresAt: Date.now() + 5_000 });
 * const entry = await store.get("route-/api/users");
 * ```
 */
export class RedisCacheStore<T extends { expiresAt: number }> implements AsyncCacheStore<T> {
  constructor(
    private readonly client: RedisClientAdapter,
    private readonly keyPrefix: string = "cache:",
  ) {}

  /**
   * Retrieve a cached entry by key.
   *
   * Returns `null` when the key is absent. Also returns `null` and evicts the
   * key when the stored entry has already expired (lazy eviction guard).
   */
  async get(key: string): Promise<T | null> {
    const rawValue = await this.client.get(this.prefixedKey(key));

    if (rawValue === null) {
      return null;
    }

    const parsedEntry = JSON.parse(rawValue, (_key, value: unknown) => {
      if (
        value !== null && typeof value === "object" &&
        "type" in value && value.type === "Buffer" &&
        "data" in value && Array.isArray(value.data)
      ) {
        return Buffer.from(value.data as number[]);
      }
      return value;
    }) as T;

    if (Date.now() > parsedEntry.expiresAt) {
      await this.client.del(this.prefixedKey(key));
      return null;
    }

    return parsedEntry;
  }

  /**
   * Persist a cache entry. The expiry is set at the Redis level using `PXAT`
   * so entries are evicted automatically even if `clear` is never called.
   */
  async set(key: string, entry: T): Promise<void> {
    const serializedEntry = JSON.stringify(entry);
    await this.client.set(this.prefixedKey(key), serializedEntry, "PXAT", entry.expiresAt);
  }

  /**
   * Remove all entries whose keys match the configured prefix.
   *
   * Uses `KEYS` for simplicity. In large production deployments, consider
   * replacing this with a `SCAN`-based sweep to avoid blocking the Redis event loop.
   */
  async clear(): Promise<void> {
    const matchingKeys = await this.client.keys(this.keyPrefix + "*");

    if (matchingKeys.length > 0) {
      await this.client.del(...matchingKeys);
    }
  }

  /**
   * Returns 0 always.
   *
   * Async size tracking across a Redis keyspace is not supported by this
   * implementation without additional bookkeeping. Use `KEYS` or `DBSIZE`
   * directly on the client if an exact count is required.
   */
  size(): number {
    return 0;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private prefixedKey(key: string): string {
    return this.keyPrefix + key;
  }
}
