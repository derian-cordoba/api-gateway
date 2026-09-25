import { EventEmitter } from "node:events";
import type { CircuitBreakerConfig } from "../../types/circuit-breaker";
import type { Clock } from "./Clock";
import type { CircuitBreakerStateStore, CircuitBreakerSnapshot } from "./CircuitBreakerStateStore";
import type { CircuitBreakerEvents, StateChangePayload } from "./CircuitBreakerEvents";
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
 *
 * Extends `EventEmitter` to allow embedders to subscribe to state transitions
 * via the typed `CircuitBreakerEvents` map.
 */
export class CircuitBreaker extends EventEmitter {
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
    super();
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
      this.transitionTo(CircuitState.HALF_OPEN);
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

  shouldRejectAsync(): Promise<boolean> {
    return Promise.resolve(this.shouldReject());
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
        this.transitionTo(CircuitState.CLOSED);
        this.successCount = 0;
        this.persist();
        logger.info({ baseURL: this.baseURL, state: CircuitState.CLOSED }, "Circuit breaker closed, upstream recovered");
        return;
      }
    }

    this.persist();
  }

  recordSuccessAsync(): Promise<void> {
    this.recordSuccess();
    return Promise.resolve();
  }

  recordFailure(): void {
    this.probing = false;
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.config.threshold) {
      this.nextAttempt = this.clock.now() + this.config.timeout;
      this.failureCount = 0;
      this.successCount = 0;
      this.transitionTo(CircuitState.OPEN);
      this.persist();
      logger.warn(
        { baseURL: this.baseURL, state: CircuitState.OPEN, retryAfterSeconds: this.retryAfterSeconds() },
        "Circuit breaker opened, upstream failing",
      );
      return;
    }

    this.persist();
  }

  recordFailureAsync(): Promise<void> {
    this.recordFailure();
    return Promise.resolve();
  }

  // ── Typed EventEmitter overrides ────────────────────────────────────────────

  emit<EventName extends keyof CircuitBreakerEvents>(
    event: EventName,
    ...args: CircuitBreakerEvents[EventName]
  ): boolean {
    return super.emit(event, ...args);
  }

  on<EventName extends keyof CircuitBreakerEvents>(
    event: EventName,
    listener: (...args: CircuitBreakerEvents[EventName]) => void,
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  once<EventName extends keyof CircuitBreakerEvents>(
    event: EventName,
    listener: (...args: CircuitBreakerEvents[EventName]) => void,
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  off<EventName extends keyof CircuitBreakerEvents>(
    event: EventName,
    listener: (...args: CircuitBreakerEvents[EventName]) => void,
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Transitions the circuit to `nextState`, updating `this.state` and emitting
   * a `stateChange` event with the previous and next states.
   * Does NOT call `persist()` — callers are responsible for persisting after transition.
   */
  private transitionTo(nextState: CircuitState): void {
    const previousState = this.state;
    this.state = nextState;
    const payload: StateChangePayload = { baseURL: this.baseURL, previousState, nextState };
    this.emit("stateChange", payload);
  }

  private persist(): void {
    this.store.save(this.baseURL, this.snapshot());
  }

  protected snapshot(): CircuitBreakerSnapshot {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt,
    };
  }

  protected restoreSnapshot(snapshot: CircuitBreakerSnapshot): void {
    if (this.state !== snapshot.state) this.probing = false;
    this.state = snapshot.state;
    this.failureCount = snapshot.failureCount;
    this.successCount = snapshot.successCount;
    this.nextAttempt = snapshot.nextAttempt;
  }
}
