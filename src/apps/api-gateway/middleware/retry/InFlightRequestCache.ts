import type { UpstreamResponse } from "./UpstreamHttpClient";

/**
 * Tracks in-flight upstream requests by a string key.
 *
 * When a second request arrives for the same key while the first is still
 * in-flight, the second request subscribes to the same Promise instead of
 * issuing a new upstream call. Once the upstream responds, all waiters
 * receive the same result simultaneously.
 *
 * This is not a response cache — entries are removed as soon as the upstream
 * call completes (success or error). It exists solely to collapse concurrent
 * burst traffic.
 */
export class InFlightRequestCache {
  private readonly pendingRequests = new Map<string, Promise<UpstreamResponse>>();

  /**
   * Returns an existing in-flight promise for `requestKey`, or calls
   * `executeRequest` to start a new upstream request and tracks it.
   *
   * The entry is removed from the map when the promise settles (either
   * resolves or rejects), so subsequent requests always start fresh.
   */
  getOrExecute(
    requestKey: string,
    executeRequest: () => Promise<UpstreamResponse>,
  ): Promise<UpstreamResponse> {
    const existingRequest = this.pendingRequests.get(requestKey);
    if (existingRequest !== undefined) return existingRequest;

    const upstreamRequest = executeRequest().finally(() => {
      this.pendingRequests.delete(requestKey);
    });

    this.pendingRequests.set(requestKey, upstreamRequest);
    return upstreamRequest;
  }

  /** Returns the number of currently in-flight requests. */
  size(): number {
    return this.pendingRequests.size;
  }
}
