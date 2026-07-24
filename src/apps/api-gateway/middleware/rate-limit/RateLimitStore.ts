/**
 * Pluggable backing store for per-route rate-limit counters.
 *
 * Implement this interface to share rate-limit state across multiple gateway
 * instances (e.g. Redis, Memcached) without changing any consumer code.
 *
 * The method signatures mirror `express-rate-limit`'s `Store` interface so
 * implementations can delegate directly.
 */
export interface RateLimitStore {
  /**
   * Increment the counter for `key` and return the updated hit count and the
   * time at which the current window resets.
   */
  increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }>;

  /** Decrement the counter for `key` by one. */
  decrement(key: string): Promise<void>;

  /** Reset the counter for `key` to zero. */
  resetKey(key: string): Promise<void>;

  /**
   * Reset counters for all keys. Called when the rate limiter is shut down or
   * reconfigured. Optional — provide a no-op if the backend doesn't support it.
   */
  resetAll?(): Promise<void>;
}
