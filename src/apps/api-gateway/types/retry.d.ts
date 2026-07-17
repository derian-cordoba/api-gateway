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
};
