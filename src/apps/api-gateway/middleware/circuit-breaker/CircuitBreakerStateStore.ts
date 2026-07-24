import { CircuitState } from "./CircuitBreaker";

/**
 * Snapshot of a circuit breaker's mutable state at a point in time.
 */
export type CircuitBreakerSnapshot = {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  nextAttempt: number;
};

/**
 * Pluggable persistence backend for `CircuitBreaker` state.
 *
 * The default implementation (`InMemoryStateStore`) keeps state in the
 * current process. Implement this interface to share state across multiple
 * gateway instances (e.g. using Redis or an external key-value store).
 */
export interface CircuitBreakerStateStore {
  /**
   * Load the latest state snapshot for the given circuit key.
   * Returns `null` when no snapshot exists (first run — the circuit starts CLOSED).
   */
  load(key: string): CircuitBreakerSnapshot | null;

  /**
   * Persist a state snapshot.
   */
  save(key: string, snapshot: CircuitBreakerSnapshot): void;
}
