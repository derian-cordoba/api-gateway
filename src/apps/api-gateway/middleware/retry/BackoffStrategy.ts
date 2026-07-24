/**
 * Abstraction for computing the delay (in milliseconds) between retry attempts.
 * Concrete implementations encapsulate a specific backoff algorithm (fixed, exponential,
 * exponential-with-jitter, etc.) so that `RetryExecutor` can depend on this interface
 * rather than on a branching `if/else` inside its own body.
 */
export interface BackoffStrategy {
  computeDelay(attemptIndex: number, baseDelayMs: number): number;
}
