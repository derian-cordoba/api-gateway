import type { BalancerStrategy, WeightedTarget } from "../../types/load-balancer";
import type { SelectionStrategy } from "./SelectionStrategy";
import { RoundRobinSelectionStrategy } from "./RoundRobinSelectionStrategy";
import { WeightedSelectionStrategy } from "./WeightedSelectionStrategy";
import { LeastConnectionsSelectionStrategy } from "./LeastConnectionsSelectionStrategy";

/**
 * Orchestrates upstream target selection by delegating all picking and
 * connection-tracking logic to a `SelectionStrategy` implementation chosen
 * at construction time.
 *
 * Adding a new balancing algorithm only requires a new `SelectionStrategy`
 * class — this orchestrator never needs to change (Open/Closed Principle).
 */
export class LoadBalancer {
  public readonly strategy: BalancerStrategy;
  private readonly selectionStrategy: SelectionStrategy;

  constructor(targets: readonly WeightedTarget[], strategy: BalancerStrategy) {
    this.strategy = strategy;
    this.selectionStrategy = LoadBalancer.buildStrategy(targets, strategy);
  }

  createRouterFn(): (req: object) => string {
    return (req: object): string => this.selectTarget(req);
  }

  /**
   * Select the next upstream target for the given request object and track
   * the association so `onConnectionClosed` can decrement the connection count.
   */
  selectTarget(req: object): string {
    const url = this.selectionStrategy.pick();
    this.selectionStrategy.trackRequest(req, url);
    return url;
  }

  onConnectionClosed(req: object): void {
    this.selectionStrategy.onConnectionClosed(req);
  }

  getConnectionCounts(): ReadonlyMap<string, number> {
    return this.selectionStrategy.getConnectionCounts();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private static buildStrategy(
    targets: readonly WeightedTarget[],
    strategy: BalancerStrategy,
  ): SelectionStrategy {
    switch (strategy) {
      case "weighted":
        return new WeightedSelectionStrategy(targets);
      case "least-connections":
        return new LeastConnectionsSelectionStrategy(targets.map((target) => target.url));
      case "round-robin":
      default:
        return new RoundRobinSelectionStrategy(targets.map((target) => target.url));
    }
  }
}
