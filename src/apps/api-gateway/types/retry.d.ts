export declare type RetryBackoff = "fixed" | "exponential";

export declare type RetryConfig = {
  /**
   * Maximum number of retry attempts after the initial failure.
   * Total upstream calls = attempts + 1.
   */
  attempts: number;

  /**
   * Base delay in milliseconds between retries.
   * For exponential backoff, each retry multiplies this by 2^n.
   */
  delay: number;

  /**
   * Backoff strategy.
   * - "fixed"       — every retry waits exactly `delay` ms
   * - "exponential" — wait grows as delay * 2^attemptIndex
   * @default "fixed"
   */
  backoff?: RetryBackoff;

  /**
   * Explicit list of HTTP status codes that should trigger a retry.
   * When omitted, all 5xx responses are retried (default behaviour).
   *
   * @example [500, 502, 503, 504]
   */
  retryOn?: number[];
};
