import type { Gateway } from "../types/gateway";
import type { StateChangePayload } from "./circuit-breaker/CircuitBreakerEvents";

export type { StateChangePayload };

export type RateLimitExceededPayload = {
  readonly baseURL: string;
  readonly key: string;
};

/**
 * Typed map of all events emitted on the gateway-level event bus.
 * Keys are event names; values are tuples of listener argument types.
 */
export type GatewayEvents = {
  /**
   * Emitted after proxy routes are successfully loaded or reloaded.
   * Payload: the new route list that is now active.
   */
  "route:reloaded": [routes: readonly Gateway[]];

  /**
   * Emitted when a circuit breaker transitions between states.
   * Re-exports `StateChangePayload` from `CircuitBreakerEvents`.
   */
  "circuitBreaker:stateChange": [payload: StateChangePayload];

  /**
   * Emitted when a request is rejected because the rate limit is exceeded.
   */
  "rateLimit:exceeded": [payload: RateLimitExceededPayload];
};
