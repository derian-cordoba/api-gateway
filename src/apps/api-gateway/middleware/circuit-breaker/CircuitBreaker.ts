import type { CircuitBreakerConfig } from "../../types/circuit-breaker";
import { logger } from "../../logger";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

/**
 * In-memory circuit breaker implementing the three-state pattern:
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
 */
export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;
  
  // True while a probe request is in flight during HALF_OPEN state.
  private probing = false;

  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly baseURL: string,
  ) {
    //
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
      if (Date.now() < this.nextAttempt) {
        return true;
      }
      // Timeout elapsed — transition to HALF_OPEN and allow one probe request.
      this.state = CircuitState.HALF_OPEN;
      this.probing = false;
      this.successCount = 0;
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
    return Math.ceil(Math.max(0, this.nextAttempt - Date.now()) / 1000);
  }

  recordSuccess(): void {
    this.probing = false;
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= (this.config.successThreshold ?? 1)) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info({ baseURL: this.baseURL, state: CircuitState.CLOSED }, "Circuit breaker closed, upstream recovered");
      }
    }
  }

  recordFailure(): void {
    this.probing = false;
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.config.threshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
      this.failureCount = 0;
      this.successCount = 0;
      logger.warn(
        { baseURL: this.baseURL, state: CircuitState.OPEN, retryAfterSeconds: this.retryAfterSeconds() },
        "Circuit breaker opened, upstream failing",
      );
    }
  }
}
