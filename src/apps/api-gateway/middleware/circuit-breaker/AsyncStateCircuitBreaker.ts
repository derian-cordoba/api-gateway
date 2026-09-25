import type { CircuitBreakerConfig } from "../../types/circuit-breaker";
import type { AsyncCircuitBreakerStateStore } from "../redis/RedisCircuitBreakerStateStore";
import { CircuitBreaker, CircuitState } from "./CircuitBreaker";

/** Reconciles breaker state with an async shared store before every decision. */
export class AsyncStateCircuitBreaker extends CircuitBreaker {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    config: CircuitBreakerConfig,
    private readonly key: string,
    private readonly sharedStore: AsyncCircuitBreakerStateStore,
  ) {
    super(config, key);
  }

  override shouldRejectAsync(): Promise<boolean> {
    return this.withSharedState(() => super.shouldReject());
  }

  override recordSuccessAsync(): Promise<void> {
    return this.withSharedState(() => super.recordSuccess());
  }

  override recordFailureAsync(): Promise<void> {
    return this.withSharedState(() => super.recordFailure());
  }

  private async withSharedState<T>(operation: () => T): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const remote = await this.sharedStore.load(this.key);
      this.restoreSnapshot(remote ?? {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        nextAttempt: 0,
      });

      const before = this.snapshot();
      const result = operation();
      const after = this.snapshot();

      if (JSON.stringify(after) !== JSON.stringify(before)) {
        await this.sharedStore.save(this.key, after);
      }

      return result;
    } finally {
      release();
    }
  }
}
