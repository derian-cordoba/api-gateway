import type { SelectionStrategy } from "./SelectionStrategy";
import type { CircuitBreaker } from "../circuit-breaker/CircuitBreaker";
import { CircuitState } from "../circuit-breaker/CircuitBreaker";

/**
 * Decorator that wraps any `SelectionStrategy` and skips targets whose
 * circuit breaker is currently open.
 *
 * When ALL breakers are open, falls back to the inner strategy unconditionally
 * to prevent a complete request blackout (the underlying backend will return 503
 * as usual, but at least a target is chosen).
 */
export class HealthAwareSelectionStrategy implements SelectionStrategy {
  constructor(
    private readonly inner: SelectionStrategy,
    private readonly breakersByUrl: ReadonlyMap<string, CircuitBreaker>,
  ) {}

  pick(req: object): string {
    // Attempt to find a healthy target by asking the inner strategy
    // multiple times (up to breakersByUrl.size + 1 times).
    // We limit attempts to avoid infinite loops when all are unhealthy.
    const maxAttempts = this.breakersByUrl.size + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = this.inner.pick(req);
      const breaker = this.breakersByUrl.get(candidate);
      if (!breaker || breaker.currentState !== CircuitState.OPEN) {
        return candidate;
      }
      // Candidate's circuit is OPEN — undo its selection and try again.
      // We release it immediately via onConnectionClosed before continuing.
      this.inner.onConnectionClosed(req);
    }

    // All circuits are open — return whatever the inner strategy picks next
    // (it will 503, but we must pick something).
    return this.inner.pick(req);
  }

  trackRequest(req: object, url: string): void {
    this.inner.trackRequest(req, url);
  }

  onConnectionClosed(req: object): void {
    this.inner.onConnectionClosed(req);
  }

  getConnectionCounts(): ReadonlyMap<string, number> {
    return this.inner.getConnectionCounts();
  }
}
