import type { BackoffStrategy } from "./BackoffStrategy";
import { appEnv } from "../../config/app-env";

/**
 * A `BackoffStrategy` implementation that grows the delay exponentially with each
 * retry attempt. The delay is computed as `baseDelayMs * multiplier^attemptIndex`,
 * so each successive attempt waits progressively longer than the previous one.
 */
export class ExponentialBackoff implements BackoffStrategy {
  constructor(private readonly multiplier: number = appEnv.proxy.retryBackoffMultiplier) {}

  computeDelay(attemptIndex: number, baseDelayMs: number): number {
    return baseDelayMs * Math.pow(this.multiplier, attemptIndex);
  }
}
