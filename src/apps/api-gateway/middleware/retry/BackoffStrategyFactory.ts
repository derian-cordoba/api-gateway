import type { BackoffStrategy } from "./BackoffStrategy";
import type { RetryBackoff } from "../../types/retry";
import { ExponentialBackoff } from "./ExponentialBackoff";
import { ExponentialJitterBackoff } from "./ExponentialJitterBackoff";
import { FixedBackoff } from "./FixedBackoff";
import { assertNever } from "../../../../shared/assertions/assertNever";

/**
 * Translates a `RetryBackoff` configuration value into the corresponding
 * `BackoffStrategy` instance. Centralises the mapping between the string-based
 * discriminant from the gateway config and the concrete strategy classes, keeping
 * `RetryExecutor` free from any knowledge of which strategies exist.
 */
export class BackoffStrategyFactory {
  static fromConfig(backoff: RetryBackoff | undefined): BackoffStrategy {
    const strategy = backoff ?? "fixed";

    switch (strategy) {
      case "exponential":        return new ExponentialBackoff();
      case "exponential-jitter": return new ExponentialJitterBackoff();
      case "fixed":              return new FixedBackoff();
      default:                   return assertNever(strategy, "retry backoff strategy");
    }
  }
}
