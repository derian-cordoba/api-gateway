import type { Request } from "express";
import type { LoadBalancer } from "../load-balancer/LoadBalancer";

/**
 * Abstracts the concern of selecting an upstream target URL for a given
 * request. `RetryExecutor` depends on this interface, not on any concrete
 * load-balancing implementation (Dependency Inversion Principle).
 */
export interface TargetSelector {
  /** Return the upstream URL to use for this request. */
  select(req: Request): string;

  /** Notify the selector that the request has completed (e.g. to free connection slot). */
  onComplete(req: Request): void;
}

/** Always returns the same fixed URL. Used when there is a single upstream target. */
export class SingleTargetSelector implements TargetSelector {
  constructor(private readonly target: string) {}

  select(_req: Request): string {
    return this.target;
  }

  onComplete(_req: Request): void {
    // Nothing to track for a single static target.
  }
}

/** Delegates to a `LoadBalancer` for multi-target routes. */
export class LoadBalancedTargetSelector implements TargetSelector {
  constructor(private readonly balancer: LoadBalancer) {}

  select(req: Request): string {
    return this.balancer.selectTarget(req);
  }

  onComplete(req: Request): void {
    this.balancer.onConnectionClosed(req);
  }
}
