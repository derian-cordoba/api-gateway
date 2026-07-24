import type { WeightedTarget } from "../../types/load-balancer";
import type { SelectionStrategy } from "./SelectionStrategy";
import { RoundRobinSelectionStrategy } from "./RoundRobinSelectionStrategy";

/**
 * Distributes traffic proportionally to each target's weight by
 * pre-expanding the URL list and delegating to round-robin.
 *
 * Example: [{url: "a", weight: 2}, {url: "b", weight: 1}]
 *   → expanded: ["a", "a", "b"]  (2:1 ratio)
 */
export class WeightedSelectionStrategy implements SelectionStrategy {
  private readonly inner: RoundRobinSelectionStrategy;

  constructor(targets: readonly WeightedTarget[]) {
    const expanded: string[] = [];
    for (const target of targets) {
      const weight = target.weight ?? 1;
      for (let i = 0; i < weight; i++) {
        expanded.push(target.url);
      }
    }
    this.inner = new RoundRobinSelectionStrategy(expanded);
  }

  pick(req: object): string {
    return this.inner.pick(req);
  }

  trackRequest(_req: object, _url: string): void {
    // Weighted round-robin does not need per-request tracking.
  }

  onConnectionClosed(_req: object): void {
    // Weighted round-robin does not track open connections.
  }

  getConnectionCounts(): ReadonlyMap<string, number> {
    return this.inner.getConnectionCounts();
  }
}
