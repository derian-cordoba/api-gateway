import type { BackoffStrategy } from "./BackoffStrategy";

/**
 * A `BackoffStrategy` implementation that returns the base delay unchanged on every
 * retry attempt. Use this when a constant wait between retries is desired, regardless
 * of how many attempts have been made.
 */
export class FixedBackoff implements BackoffStrategy {
  computeDelay(_attemptIndex: number, baseDelayMs: number): number {
    return baseDelayMs;
  }
}
