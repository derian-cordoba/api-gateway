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
   * - `"jwt:<claim>"` — claim extracted from the decoded JWT payload
   *   (e.g. `"jwt:sub"`). Falls back to IP when the token or claim is absent.
   */
  keyBy?: string;
};
