export declare type CircuitBreakerFallback = {
  /** HTTP status code. Defaults to 503. */
  status?: number;
  /** Response body serialized to JSON. When omitted, no body is sent. */
  body?: unknown;
  /** Additional response headers (e.g. `{ "Cache-Control": "no-store" }`). */
  headers?: Record<string, string>;
};

export declare type HealthCheckConfig = {
  /**
   * URL to probe (HTTP GET). A 2xx response counts as a success.
   */
  url: string;

  /**
   * Interval in milliseconds between probe requests.
   */
  intervalMs: number;

  /**
   * Timeout for each probe request in milliseconds.
   * @default 5000
   */
  timeoutMs?: number;
};

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

  /**
   * When configured, an active health-check probe periodically pings the given
   * URL while the circuit is open, accelerating recovery without waiting for
   * real traffic to act as probes.
   */
  healthCheck?: HealthCheckConfig;

  /**
   * Static response to serve while the circuit is open.
   * When omitted, the gateway returns the default 503 JSON error.
   *
   * Useful for degraded-mode responses (e.g. `{ "degraded": true }`),
   * maintenance pages, or redirect responses.
   */
  fallback?: CircuitBreakerFallback;
};
