export declare type CircuitBreakerConfig = {
  /**
   * Number of consecutive failures before the circuit opens.
   */
  threshold: number;

  /**
   * Milliseconds the circuit stays open before transitioning to half-open.
   */
  timeout: number;

  /**
   * Number of consecutive successes in half-open state before the circuit closes.
   * Defaults to 1.
   */
  successThreshold?: number;
};
