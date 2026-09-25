import type { BalancerStrategy, WeightedTarget } from "../../types/load-balancer";
import type { SelectionStrategy } from "./SelectionStrategy";
import type { CircuitBreaker } from "../circuit-breaker/CircuitBreaker";
import { RoundRobinSelectionStrategy } from "./RoundRobinSelectionStrategy";
import { WeightedSelectionStrategy } from "./WeightedSelectionStrategy";
import { LeastConnectionsSelectionStrategy } from "./LeastConnectionsSelectionStrategy";
import { StickySelectionStrategy } from "./StickySelectionStrategy";
import { HealthAwareSelectionStrategy } from "./HealthAwareSelectionStrategy";
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
  private readonly selectedTargets = new WeakMap<object, string>();
  private readonly breakersByUrl: ReadonlyMap<string, CircuitBreaker>;

  constructor(
    targets: readonly WeightedTarget[],
    strategy: BalancerStrategy,
    stickyKey?: string,
    breakersByUrl?: ReadonlyMap<string, CircuitBreaker>,
  ) {
    this.strategy = strategy;
    const strategyImplementation = LoadBalancer.buildStrategy(targets, strategy, stickyKey);
    this.breakersByUrl = breakersByUrl ?? new Map();
    this.selectionStrategy = breakersByUrl && breakersByUrl.size > 0
      ? new HealthAwareSelectionStrategy(strategyImplementation, breakersByUrl)
      : strategyImplementation;
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
    this.selectedTargets.set(req, url);
    return url;
  }

  onConnectionClosed(req: object): void {
    this.selectionStrategy.onConnectionClosed(req);
  }

  recordSuccess(req: object): void {
    this.breakersByUrl.get(this.selectedTargets.get(req) ?? "")?.recordSuccess();
  }

  recordFailure(req: object): void {
    this.breakersByUrl.get(this.selectedTargets.get(req) ?? "")?.recordFailure();
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
