import type { CircuitBreakerConfig } from "../../types/circuit-breaker";
import type { Clock } from "./Clock";
import type { CircuitBreakerStateStore } from "./CircuitBreakerStateStore";
import { SystemClock } from "./SystemClock";
import { InMemoryStateStore } from "./InMemoryStateStore";
import { appEnv } from "../../config/app-env";
import { logger } from "../../logger";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit breaker implementing the three-state pattern:
 *
 * CLOSED   → normal operation; failures are counted
 * OPEN     → upstream is failing; requests are rejected immediately (503)
 * HALF_OPEN → timeout elapsed; one probe request is allowed through to test recovery
 *
 * State transitions:
 *  CLOSED  → OPEN      when failureCount >= threshold
 *  OPEN    → HALF_OPEN when timeout has elapsed
 *  HALF_OPEN → CLOSED  when successCount >= successThreshold
 *  HALF_OPEN → OPEN    on any failure (probe failed)
 *
 * State is persisted through the injected `CircuitBreakerStateStore`, allowing
 * external backends (e.g. Redis) to share state across gateway instances.
 */
export class CircuitBreaker {
  private state: CircuitState;
  private failureCount: number;
  private successCount: number;
  private nextAttempt: number;

  // True while a probe request is in flight during HALF_OPEN state.
  // This is intentionally NOT persisted — it is per-process, ephemeral state.
  private probing = false;

  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly baseURL: string,
    private readonly clock: Clock = new SystemClock(),
    private readonly store: CircuitBreakerStateStore = new InMemoryStateStore(),
  ) {
    // Restore state from the store if a snapshot was previously saved.
    const snapshot = this.store.load(baseURL);
    this.state = snapshot?.state ?? CircuitState.CLOSED;
    this.failureCount = snapshot?.failureCount ?? 0;
    this.successCount = snapshot?.successCount ?? 0;
    this.nextAttempt = snapshot?.nextAttempt ?? 0;
  }

  get currentState(): CircuitState {
    return this.state;
  }

  /**
   * Returns true if the incoming request should be rejected without forwarding.
   * Handles the OPEN → HALF_OPEN transition when the reset timeout has elapsed.
   */
  shouldReject(): boolean {
    if (this.state === CircuitState.OPEN) {
      if (this.clock.now() < this.nextAttempt) {
        return true;
      }
      // Timeout elapsed — transition to HALF_OPEN and allow one probe request.
      this.state = CircuitState.HALF_OPEN;
      this.probing = false;
      this.successCount = 0;
      this.persist();
      logger.warn({ baseURL: this.baseURL, state: this.state }, "Circuit breaker half-open, probing upstream");
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.probing) {
        // Only one probe at a time; reject other requests until the probe resolves.
        return true;
      }
      this.probing = true;
      return false;
    }

    return false; // CLOSED — let the request through
  }

  /**
   * Seconds until the circuit transitions to half-open. Only meaningful in OPEN state.
   */
  retryAfterSeconds(): number {
    return Math.ceil(Math.max(0, this.nextAttempt - this.clock.now()) / 1000);
  }

  recordSuccess(): void {
    this.probing = false;
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= (this.config.successThreshold ?? appEnv.proxy.circuitBreakerSuccessThreshold)) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.persist();
        logger.info({ baseURL: this.baseURL, state: CircuitState.CLOSED }, "Circuit breaker closed, upstream recovered");
        return;
      }
    }

    this.persist();
  }

  recordFailure(): void {
    this.probing = false;
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.config.threshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = this.clock.now() + this.config.timeout;
      this.failureCount = 0;
      this.successCount = 0;
      this.persist();
      logger.warn(
        { baseURL: this.baseURL, state: CircuitState.OPEN, retryAfterSeconds: this.retryAfterSeconds() },
        "Circuit breaker opened, upstream failing",
      );
      return;
    }

    this.persist();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private persist(): void {
    this.store.save(this.baseURL, {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
    });
  }
}
