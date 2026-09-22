import type { BalancerStrategy, WeightedTarget } from "../../types/load-balancer";
import type { SelectionStrategy } from "./SelectionStrategy";
import { RoundRobinSelectionStrategy } from "./RoundRobinSelectionStrategy";
import { WeightedSelectionStrategy } from "./WeightedSelectionStrategy";
import { LeastConnectionsSelectionStrategy } from "./LeastConnectionsSelectionStrategy";
import { StickySelectionStrategy } from "./StickySelectionStrategy";
import { RequestKeyExtractorFactory } from "../key-extractors/RequestKeyExtractorFactory";
import { assertNever } from "../../../../shared/assertions/assertNever";

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

  constructor(
    targets: readonly WeightedTarget[],
    strategy: BalancerStrategy,
    stickyKey?: string,
  ) {
    this.strategy = strategy;
    this.selectionStrategy = LoadBalancer.buildStrategy(targets, strategy, stickyKey);
  }

  createRouterFn(): (req: object) => string {
    return (req: object): string => this.selectTarget(req);
  }

  /**
   * Select the next upstream target for the given request object and track
   * the association so `onConnectionClosed` can decrement the connection count.
   */
  selectTarget(req: object): string {
    const url = this.selectionStrategy.pick(req);
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
    stickyKey?: string,
  ): SelectionStrategy {
    switch (strategy) {
      case "weighted":
        return new WeightedSelectionStrategy(targets);
      case "least-connections":
        return new LeastConnectionsSelectionStrategy(targets.map((target) => target.url));
      case "sticky":
        return new StickySelectionStrategy(
          targets.map((target) => target.url),
          RequestKeyExtractorFactory.fromSpec(stickyKey ?? "header:X-Session-ID"),
        );
      case "round-robin":
        return new RoundRobinSelectionStrategy(targets.map((target) => target.url));
      default:
        return assertNever(strategy, "load-balancer strategy");
    }
  }
}
