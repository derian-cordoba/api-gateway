export declare type RateLimit = {
  /**
   * The maximum number of requests allowed within the specified time window.
   */
  max: number;

  /**
   * The time window in milliseconds for which the rate limit applies.
   */
  windowMs: number;

  /**
   * The HTTP status code to return when the rate limit is exceeded.
   */
  statusCode?: number;

  /**
   * The message to return when the rate limit is exceeded.
   */
  message?: string;

  /**
   * Determines how the rate-limit key is derived for each request.
   *
   * - `"ip"` (default) — client IP address.
   * - `"header:<name>"` — value of the named request header (e.g. `"header:X-API-Key"`).
   * - `"jwt:<claim>"` — claim from the decoded JWT payload (e.g. `"jwt:sub"`).
   * - `"cookie:<name>"` — value of a named cookie (e.g. `"cookie:session_id"`).
   * - `"query:<name>"` — value of a named query-string parameter (e.g. `"query:api_key"`).
   */
  keyBy?: string;

  /**
   * A synchronous predicate evaluated before the counter is checked.
   * When it returns `true`, the request bypasses rate limiting entirely.
   * Useful for skipping health-check probes or authenticated admin tokens.
   *
   * Note: this field is not serializable to JSON — set it programmatically
   * when embedding the gateway as a library.
   */
  skip?: (req: import("express").Request) => boolean;

  /**
   * Optional pluggable backing store for rate-limit counters.
   *
   * When provided, counter state is delegated to this store instead of the
   * default in-process memory. Use a Redis-backed implementation to share
   * counters across multiple gateway replicas.
   *
   * @see `RateLimitStore` in `middleware/rate-limit/RateLimitStore.ts`
   */
  store?: import("../middleware/rate-limit/RateLimitStore").RateLimitStore;
};
