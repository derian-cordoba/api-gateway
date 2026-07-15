import type { BalancerStrategy, WeightedTarget } from "../../types/load-balancer";

export class LoadBalancer {
  private readonly expanded: readonly string[];
  private readonly connectionCount: Map<string, number>;
  private readonly reqTarget = new WeakMap<object, string>();
  private rrIndex = 0;
  
  public readonly strategy: BalancerStrategy;

  constructor(targets: readonly WeightedTarget[], strategy: BalancerStrategy) {
    this.strategy = strategy;

    // Pre-expand targets for round-robin and weighted strategies
    if (strategy === "weighted") {
      const expanded: string[] = [];
      for (const target of targets) {
        const weight = target.weight ?? 1;
        for (let i = 0; i < weight; i++) {
          expanded.push(target.url);
        }
      }
      this.expanded = expanded;
    } else {
      // round-robin and least-connections: all targets equally
      this.expanded = targets.map((target) => target.url);
    }

    // Initialize connection count map for all unique URLs
    this.connectionCount = new Map<string, number>();
    for (const target of targets) {
      if (!this.connectionCount.has(target.url)) {
        this.connectionCount.set(target.url, 0);
      }
    }
  }

  createRouterFn(): (req: object) => string {
    return (req: object): string => {
      const url = this.pick();
      this.reqTarget.set(req, url);

      if (this.strategy === "least-connections") {
        this.connectionCount.set(url, (this.connectionCount.get(url) ?? 0) + 1);
      }

      return url;
    };
  }

  onConnectionClosed(req: object): void {
    if (this.strategy !== "least-connections") return;

    const url = this.reqTarget.get(req);
    if (url === undefined) return;

    const current = this.connectionCount.get(url) ?? 0;
    if (current <= 1) {
      this.connectionCount.set(url, 0);
    } else {
      this.connectionCount.set(url, current - 1);
    }

    this.reqTarget.delete(req);
  }

  getConnectionCounts(): ReadonlyMap<string, number> {
    return this.connectionCount;
  }

  private pick(): string {
    if (this.strategy === "least-connections") {
      return this.pickLeastConnections();
    }

    // round-robin (also used for weighted via pre-expanded array)
    const url = this.expanded[this.rrIndex % this.expanded.length];
    this.rrIndex = (this.rrIndex + 1) % this.expanded.length;
    return url;
  }

  private pickLeastConnections(): string {
    let minCount = Infinity;
    let [chosen] = this.expanded;

    for (const url of this.expanded) {
      const count = this.connectionCount.get(url) ?? 0;
      if (count < minCount) {
        minCount = count;
        chosen = url;
      }
    }

    return chosen;
  }
}
