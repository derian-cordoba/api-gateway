import type { UpstreamResponse } from "./UpstreamHttpClient";

/**
 * Tracks in-flight upstream requests by a string key.
 *
 * When a second request arrives for the same key while the first is still
 * in-flight, the second request subscribes to the same Promise instead of
 * issuing a new upstream call. Each subscriber can still cancel its own
 * wait without aborting the shared upstream operation.
 *
 * This is not a response cache — entries are removed as soon as the upstream
 * call completes (success or error). It exists solely to collapse concurrent
 * burst traffic.
 */
export class InFlightRequestCache {
  private readonly pendingRequests = new Map<string, Promise<UpstreamResponse>>();

  /**
   * Returns an existing in-flight promise for `requestKey`, or calls
   * `executeRequest` to start a new upstream request and tracks it. The
   * optional signal only controls this caller's subscription.
   *
   * The entry is removed from the map when the promise settles (either
   * resolves or rejects), so subsequent requests always start fresh.
   */
  getOrExecute(
    requestKey: string,
    executeRequest: (signal: AbortSignal) => Promise<UpstreamResponse>,
    signal?: AbortSignal,
  ): Promise<UpstreamResponse> {
    const existingRequest = this.pendingRequests.get(requestKey);
    if (existingRequest !== undefined) return this.subscribe(existingRequest, signal);

    const controller = new AbortController();
    const upstreamRequest = executeRequest(controller.signal).finally(() => {
      this.pendingRequests.delete(requestKey);
    });

    this.pendingRequests.set(requestKey, upstreamRequest);
    return this.subscribe(upstreamRequest, signal);
  }

  private subscribe(
    request: Promise<UpstreamResponse>,
    signal?: AbortSignal,
  ): Promise<UpstreamResponse> {
    if (!signal) return request;
    if (signal.aborted) return Promise.reject(this.abortError());

    return new Promise<UpstreamResponse>((resolve, reject) => {
      const abort = (): void => {
        signal.removeEventListener("abort", abort);
        reject(this.abortError());
      };
      signal.addEventListener("abort", abort, { once: true });
      request.then(
        (value) => {
          signal.removeEventListener("abort", abort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener("abort", abort);
          reject(error);
        },
      );
    });
  }

  private abortError(): Error {
    const error = new Error("Request aborted");
    error.name = "AbortError";
    return error;
  }

  /** Returns the number of currently in-flight requests. */
  size(): number {
    return this.pendingRequests.size;
  }
}
