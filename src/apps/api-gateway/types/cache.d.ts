export declare type CacheConfig = {
  /**
   * Time-to-live in milliseconds. Cached entries are served until this
   * duration elapses after the first upstream response.
   */
  ttl: number;

  /**
   * HTTP methods to cache. Only safe, idempotent methods make sense here.
   * @default ["GET", "HEAD"]
   */
  methods?: string[];

  /**
   * HTTP status codes whose responses should be cached.
   * @default [200, 203, 204]
   */
  statusCodes?: number[];

  /**
   * When set, responses past their TTL but within `ttl + staleWhileRevalidateMs`
   * are served immediately while a background refresh is triggered. This reduces
   * tail latency at the cost of briefly serving slightly outdated data.
   */
  staleWhileRevalidateMs?: number;

  /**
   * When set, a background timer runs every `evictionIntervalMs` milliseconds
   * to proactively remove expired entries from memory. Without this, entries
   * are only evicted lazily on `get()`. Useful for routes with many unique URLs
   * that are cached but rarely re-requested.
   */
  evictionIntervalMs?: number;
};
