/**
 * Encapsulates target-selection logic for a load-balancer strategy.
 * Each implementation is responsible for picking a URL and tracking
 * per-request state (e.g. connection counts) independently of the
 * LoadBalancer orchestrator.
 */
export interface SelectionStrategy {
  /** Pick the next upstream URL. */
  pick(): string;

  /**
   * Associate the chosen URL with a request object so that
   * `onConnectionClosed` can later dereference it.
   */
  trackRequest(req: object, url: string): void;

  /** Notify the strategy that a request has completed. */
  onConnectionClosed(req: object): void;

  /**
   * Returns the current active-connection count per URL.
   * Strategies that don't track connections return a map of all URLs → 0.
   */
  getConnectionCounts(): ReadonlyMap<string, number>;
}
