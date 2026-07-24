import type { SelectionStrategy } from "./SelectionStrategy";

/**
 * Cycles through all URLs in order, wrapping around at the end.
 * Works for both plain round-robin and weighted round-robin
 * (the caller pre-expands the URL list by weight).
 */
export class RoundRobinSelectionStrategy implements SelectionStrategy {
  private index = 0;
  private readonly zeroCounts: ReadonlyMap<string, number>;

  constructor(private readonly urls: readonly string[]) {
    this.zeroCounts = new Map(urls.map((url) => [url, 0]));
  }

  pick(_req: object): string {
    const url = this.urls[this.index % this.urls.length];
    this.index = (this.index + 1) % this.urls.length;
    return url;
  }

  trackRequest(_req: object, _url: string): void {
    // Round-robin does not need per-request tracking.
  }

  onConnectionClosed(_req: object): void {
    // Round-robin does not track open connections.
  }

  getConnectionCounts(): ReadonlyMap<string, number> {
    return this.zeroCounts;
  }
}
