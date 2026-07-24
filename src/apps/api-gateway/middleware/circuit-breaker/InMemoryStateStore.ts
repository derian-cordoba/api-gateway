import type { CircuitBreakerStateStore, CircuitBreakerSnapshot } from "./CircuitBreakerStateStore";

/**
 * Default in-process `CircuitBreakerStateStore` implementation.
 *
 * State is held in a plain `Map` and does not survive process restarts or
 * hot-reloads. For distributed deployments, provide an external-store
 * implementation via the `CircuitBreakerStateStore` interface.
 */
export class InMemoryStateStore implements CircuitBreakerStateStore {
  private readonly snapshots = new Map<string, CircuitBreakerSnapshot>();

  load(key: string): CircuitBreakerSnapshot | null {
    return this.snapshots.get(key) ?? null;
  }

  save(key: string, snapshot: CircuitBreakerSnapshot): void {
    this.snapshots.set(key, snapshot);
  }
}
