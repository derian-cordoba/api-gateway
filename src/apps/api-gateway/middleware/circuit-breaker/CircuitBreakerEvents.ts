import type { CircuitState } from "./CircuitBreaker";

/**
 * Typed event map for `CircuitBreaker`. Each key is an event name; the value
 * is the tuple of argument types passed to listeners.
 */
export type CircuitBreakerEvents = {
  /** Fired whenever the circuit transitions between states. */
  stateChange: [payload: StateChangePayload];
};

export type StateChangePayload = {
  readonly baseURL: string;
  readonly previousState: CircuitState;
  readonly nextState: CircuitState;
};
