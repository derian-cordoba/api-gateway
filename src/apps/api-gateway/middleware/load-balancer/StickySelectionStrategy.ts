import type { Request } from "express";
import type { SelectionStrategy } from "./SelectionStrategy";
import type { RequestKeyExtractor } from "../key-extractors/RequestKeyExtractor";
import { RoundRobinSelectionStrategy } from "./RoundRobinSelectionStrategy";

/**
 * Session-affinity (sticky) selection strategy.
 *
 * Routes a request to the same upstream target on every call by mapping a
 * session key to a target URL. The key is derived by the injected
 * `RequestKeyExtractor` (e.g. cookie, header).
 *
 * When no session key is present (first visit), a target is chosen by
 * round-robin and the key→target mapping is stored for subsequent requests.
 *
 * Note: mappings are stored in-process only and are lost on gateway restart
 * or hot-reload. For durable affinity, use an external session store.
 */
export class StickySelectionStrategy implements SelectionStrategy {
  private readonly stickyMap = new Map<string, string>();
  private readonly roundRobin: RoundRobinSelectionStrategy;
  private readonly zeroCounts: ReadonlyMap<string, number>;

  constructor(
    private readonly urls: readonly string[],
    private readonly keyExtractor: RequestKeyExtractor,
  ) {
    this.roundRobin = new RoundRobinSelectionStrategy(urls);
    this.zeroCounts = new Map(urls.map((url) => [url, 0]));
  }

  pick(req: object): string {
    const key = this.keyExtractor.extract(req as Request);

    if (key !== null) {
      const pinned = this.stickyMap.get(key);
      if (pinned !== undefined && this.urls.includes(pinned)) {
        return pinned;
      }
    }

    const url = this.roundRobin.pick(req);
    if (key !== null) {
      this.stickyMap.set(key, url);
    }
    return url;
  }

  trackRequest(_req: object, _url: string): void {
    // Sticky sessions don't need additional per-request tracking.
  }

  onConnectionClosed(_req: object): void {
    // Sticky sessions don't track open connections.
  }

  getConnectionCounts(): ReadonlyMap<string, number> {
    return this.zeroCounts;
  }
}
