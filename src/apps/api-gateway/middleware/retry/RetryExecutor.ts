import type { Request } from "express";
import { createHash } from "node:crypto";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { RetryConfig } from "../../types/retry";
import type { CircuitBreaker } from "../circuit-breaker/CircuitBreaker";
import type { UpstreamHttpClient, UpstreamResponse } from "./UpstreamHttpClient";
import type { TargetSelector } from "./TargetSelector";
import type { BackoffStrategy } from "./BackoffStrategy";
import { RetryExhaustedException } from "./RetryExhaustedException";
import { FixedBackoff } from "./FixedBackoff";
import { InFlightRequestCache } from "./InFlightRequestCache";
import { logger } from "../../logger";
import { toError } from "../../../../shared/errors/toError";
import { abortableDelay } from "../../../../shared/async/abortableDelay";

/**
 * Orchestrates the retry loop for upstream HTTP requests.
 *
 * Responsibilities (and nothing else):
 *  - Iterate up to `config.attempts` times
 *  - Delegate target selection to `TargetSelector`
 *  - Delegate the actual HTTP call to `UpstreamHttpClient`
 *  - Record circuit-breaker outcomes
 *  - Apply backoff delays between attempts via a `BackoffStrategy`
 *  - Skip retries for non-idempotent HTTP methods unless explicitly allowed
 *  - Abort immediately if the client disconnects (via `AbortSignal`)
 *  - Throw `RetryExhaustedException` when all attempts fail
 *
 * This class deliberately knows nothing about the Express `Response` object.
 * Writing the response is the caller's responsibility.
 */
export class RetryExecutor {
  constructor(
    private readonly config: RetryConfig,
    private readonly client: UpstreamHttpClient,
    private readonly selector: TargetSelector,
    private readonly breaker: CircuitBreaker | null,
    private readonly backoffStrategy: BackoffStrategy = new FixedBackoff(),
    private readonly inFlightCache: InFlightRequestCache = new InFlightRequestCache(),
  ) { }

  execute(req: Request, body: Buffer, signal: AbortSignal): Promise<UpstreamResponse> {
    if (this.isCollapsible(req)) {
      const collapseKey = this.buildCollapseKey(req, body);
      return this.inFlightCache.getOrExecute(
        collapseKey,
        (sharedSignal) => this.executeWithRetry(req, body, sharedSignal),
        signal,
      );
    }
    return this.executeWithRetry(req, body, signal);
  }

  private async executeWithRetry(req: Request, body: Buffer, signal: AbortSignal): Promise<UpstreamResponse> {
    let lastStatus = 0;
    let lastErr: Error | undefined;

    for (let attempt = 0; attempt <= this.config.attempts; attempt++) {
      if (signal.aborted) break;

      const target = this.selector.select(req);

      try {
        const upstream = await this.client.send({ target, req, body, signal });
        const { statusCode } = upstream;

        if (this.isRetryable(statusCode) && attempt < this.config.attempts) {
          if (!this.isSafeToRetry(req.method)) {
            await this.breaker?.recordFailureAsync();
            this.selector.onFailure?.(req);
            this.selector.onComplete(req);
            logger.warn(
              { baseURL: req.baseUrl, method: req.method, attempt, status: statusCode },
              "Upstream returned retryable status but method is not safe to retry — returning response",
            );
            return upstream;
          }

          await this.breaker?.recordFailureAsync();
          this.selector.onFailure?.(req);
          lastStatus = statusCode;
          lastErr = undefined;
          logger.warn({ baseURL: req.baseUrl, attempt, status: statusCode }, "Upstream returned 5xx — retrying");
          await this.delay(attempt, signal);
          this.selector.onComplete(req);
          continue;
        }

        // Final attempt or successful response — record outcome and return.
        if (statusCode < HttpStatus.INTERNAL_SERVER_ERROR) {
          await this.breaker?.recordSuccessAsync();
          this.selector.onSuccess?.(req);
        } else {
          await this.breaker?.recordFailureAsync();
          this.selector.onFailure?.(req);
        }

        this.selector.onComplete(req);
        return upstream;
      } catch (err) {
        await this.breaker?.recordFailureAsync();
        this.selector.onFailure?.(req);
        lastErr = toError(err);
        lastStatus = 0;

        if (!this.isSafeToRetry(req.method)) {
          break;
        }

        if (attempt < this.config.attempts && !signal.aborted) {
          logger.warn(
            { baseURL: req.baseUrl, attempt, err: lastErr.message },
            "Upstream network error — retrying",
          );
          try {
            await this.delay(attempt, signal);
          } catch {
            break; // AbortError from sleep — stop immediately
          }
        }
      }
    }

    throw new RetryExhaustedException(lastStatus, lastErr);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildCollapseKey(req: Request, body: Buffer): string {
    // An upstream may vary its response on any request header. Include the
    // complete header set (including request IDs) so only equivalent requests
    // can share one response. Hashing keeps credentials out of map keys.
    const headers = Object.entries(req.headers)
      .map(([name, value]) => [name.toLowerCase(), value] as const)
      .sort(([left], [right]) => left.localeCompare(right));
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ headers, ip: req.ip ?? "" }))
      .update(body)
      .digest("hex");
    return `${req.method}:${req.url}:${fingerprint}`;
  }

  private isCollapsible(req: Request): boolean {
    return (
      this.config.collapseRequests === true &&
      ["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())
    );
  }

  private isRetryable(statusCode: number): boolean {
    if (this.config.retryOn) {
      return this.config.retryOn.includes(statusCode);
    }
    return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private isSafeToRetry(method: string): boolean {
    if (this.config.retryMethods !== undefined) {
      return this.config.retryMethods
        .map((value) => value.toUpperCase())
        .includes(method.toUpperCase());
    }
    return ["GET", "HEAD", "OPTIONS"].includes(method);
  }

  private delay(attemptIndex: number, signal: AbortSignal): Promise<void> {
    const milliseconds = this.backoffStrategy.computeDelay(attemptIndex, this.config.delay);
    return abortableDelay(milliseconds, signal);
  }
}
