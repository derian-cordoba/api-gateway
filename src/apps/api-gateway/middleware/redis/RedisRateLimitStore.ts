import type { RateLimitStore, RateLimitIncrementResult } from "../rate-limit/RateLimitStore";

/**
 * Minimal Redis client interface required by RedisRateLimitStore.
 * Compatible with ioredis and node-redis clients — users install the Redis
 * package of their choice separately; no hard dependency is introduced here.
 */
export interface RedisRateLimitClientAdapter {
  incr(key: string): Promise<number>;
  pexpireat(key: string, milliseconds: number): Promise<number>;
  pttl(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
}

/**
 * Redis-backed implementation of `RateLimitStore`.
 *
 * Uses atomic Redis integer counters (`INCR` / `DECR`) to track per-key hit
 * counts and `PEXPIREAT` to enforce sliding-window expiry at the Redis layer.
 * This makes the store safe to use across multiple gateway instances.
 *
 * The window is anchored on the first request in the window: when `INCR`
 * returns 1, the key is brand-new and the expiry is set to
 * `now + windowMs`. Subsequent requests within the same window reuse the
 * existing expiry (PTTL is read to compute `resetTime`).
 *
 * @example
 * ```ts
 * import Redis from "ioredis";
 * const store = new RedisRateLimitStore(new Redis(), 60_000, "gateway:ratelimit:");
 * const { totalHits, resetTime } = await store.increment("192.168.1.1");
 * ```
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly client: RedisRateLimitClientAdapter,
    private readonly windowMs: number,
    private readonly keyPrefix: string = "ratelimit:",
  ) {}

  /**
   * Atomically increment the counter for `key` and return the updated hit
   * count together with the time at which the current window resets.
   *
   * On the first hit within a window, sets the key's expiry to
   * `now + windowMs` using millisecond-precision `PEXPIREAT`.
   */
  async increment(key: string): Promise<RateLimitIncrementResult> {
    const prefixedKey = this.prefixedKey(key);
    const totalHits = await this.client.incr(prefixedKey);

    if (totalHits === 1) {
      // First hit in this window — anchor the expiry.
      await this.client.pexpireat(prefixedKey, Date.now() + this.windowMs);
    }

    const remainingTtlMs = await this.client.pttl(prefixedKey);
    const resetTime = new Date(Date.now() + Math.max(0, remainingTtlMs));

    return { totalHits, resetTime };
  }

  /**
   * Decrement the counter for `key` by one.
   *
   * This is a best-effort correction (e.g. for undoing a previously counted
   * request). The key's expiry is left unchanged.
   */
  async decrement(key: string): Promise<void> {
    await this.client.decr(this.prefixedKey(key));
  }

  /**
   * Delete the counter key for `key`, effectively resetting it to zero.
   */
  async resetKey(key: string): Promise<void> {
    await this.client.del(this.prefixedKey(key));
  }

  /**
   * Not supported — Redis does not provide a way to atomically delete all
   * keys matching a prefix without `SCAN`.
   *
   * To reset all rate-limit keys, use a Redis `SCAN` loop with the pattern
   * `<keyPrefix>*` and `DEL` the results in batches.
   *
   * @throws {Error} Always.
   */
  async resetAll(): Promise<void> {
    throw new Error(
      "RedisRateLimitStore.resetAll() is not supported — use Redis SCAN to find and delete rate-limit keys",
    );
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private prefixedKey(key: string): string {
    return this.keyPrefix + key;
  }
}
