import type { SelectionStrategy } from "./SelectionStrategy";

/**
 * Routes each request to the upstream with the fewest active connections.
 * Tracks live connections via a `Map<url, count>` and associates each
 * request object with its chosen URL via a `WeakMap` so the count can be
 * decremented when the connection closes.
 */
export class LeastConnectionsSelectionStrategy implements SelectionStrategy {
  private readonly connectionCount: Map<string, number>;
  private readonly reqTarget = new WeakMap<object, string>();

  constructor(private readonly urls: readonly string[]) {
    this.connectionCount = new Map(urls.map((url) => [url, 0]));
  }

  pick(): string {
    let minCount = Infinity;
    let chosen = this.urls[0];

    for (const url of this.urls) {
      const count = this.connectionCount.get(url) ?? 0;
      if (count < minCount) {
        minCount = count;
        chosen = url;
      }
    }

    this.connectionCount.set(chosen, (this.connectionCount.get(chosen) ?? 0) + 1);
    return chosen;
  }

  trackRequest(req: object, url: string): void {
    this.reqTarget.set(req, url);
  }

  onConnectionClosed(req: object): void {
    const url = this.reqTarget.get(req);
    if (url === undefined) return;

    const current = this.connectionCount.get(url) ?? 0;
    this.connectionCount.set(url, Math.max(0, current - 1));
    this.reqTarget.delete(req);
  }

  getConnectionCounts(): ReadonlyMap<string, number> {
    return this.connectionCount;
  }
}
