export declare type RetryBackoff = "fixed" | "exponential" | "exponential-jitter";

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
   * - "fixed"               — every retry waits exactly `delay` ms
   * - "exponential"         — wait grows as delay * multiplier^attemptIndex
   * - "exponential-jitter"  — full-jitter variant: Math.random() * delay * multiplier^attemptIndex
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

  /**
   * HTTP methods that are eligible for retry. Defaults to ["GET", "HEAD", "OPTIONS"]
   * (safe, idempotent methods) when omitted.
   *
   * Explicitly include "POST", "PUT", or "PATCH" only when the upstream is
   * guaranteed to be idempotent (e.g. upserts, pure functions).
   */
  retryMethods?: string[];
};
