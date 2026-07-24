import type { BackoffStrategy } from "./BackoffStrategy";
import { appEnv } from "../../config/app-env";

/**
 * A `BackoffStrategy` implementation that applies "full jitter" to an exponential
 * backoff schedule. The delay is computed as `Math.random() * baseDelayMs * multiplier^attemptIndex`,
 * which uniformly samples a value between zero and the deterministic exponential cap. This
 * reduces thundering-herd effects when many clients retry simultaneously.
 */
export class ExponentialJitterBackoff implements BackoffStrategy {
  constructor(private readonly multiplier: number = appEnv.proxy.retryBackoffMultiplier) {}

  computeDelay(attemptIndex: number, baseDelayMs: number): number {
    return Math.random() * baseDelayMs * Math.pow(this.multiplier, attemptIndex);
  }
}
