import type { Request } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { RetryConfig } from "../../types/retry";
import type { CircuitBreaker } from "../circuit-breaker/CircuitBreaker";
import type { UpstreamHttpClient, UpstreamResponse } from "./UpstreamHttpClient";
import type { TargetSelector } from "./TargetSelector";
import type { BackoffStrategy } from "./BackoffStrategy";
import { RetryExhaustedException } from "./RetryExhaustedException";
import { FixedBackoff } from "./FixedBackoff";
import { logger } from "../../logger";

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
  ) {}

  async execute(req: Request, body: Buffer, signal: AbortSignal): Promise<UpstreamResponse> {
    let lastStatus = 0;
    let lastErr: Error | undefined;

    for (let attempt = 0; attempt <= this.config.attempts; attempt++) {
      if (signal.aborted) break;

      const target = this.selector.select(req);

      try {
        const upstream = await this.client.send({ target, req, body });
        const { statusCode } = upstream;

        if (this.isRetryable(statusCode) && attempt < this.config.attempts) {
          if (!this.isSafeToRetry(req.method)) {
            this.breaker?.recordFailure();
            this.selector.onComplete(req);
            logger.warn(
              { baseURL: req.baseUrl, method: req.method, attempt, status: statusCode },
              "Upstream returned retryable status but method is not safe to retry — returning response",
            );
            return upstream;
          }

          this.breaker?.recordFailure();
          lastStatus = statusCode;
          lastErr = undefined;
          logger.warn({ baseURL: req.baseUrl, attempt, status: statusCode }, "Upstream returned 5xx — retrying");
          await this.sleep(attempt, signal);
          this.selector.onComplete(req);
          continue;
        }

        // Final attempt or successful response — record outcome and return.
        if (statusCode < HttpStatus.INTERNAL_SERVER_ERROR) {
          this.breaker?.recordSuccess();
        } else {
          this.breaker?.recordFailure();
        }

        this.selector.onComplete(req);
        return upstream;
      } catch (err) {
        this.breaker?.recordFailure();
        lastErr = err as Error;
        lastStatus = 0;

        if (attempt < this.config.attempts && !signal.aborted) {
          logger.warn(
            { baseURL: req.baseUrl, attempt, err: lastErr.message },
            "Upstream network error — retrying",
          );
          try {
            await this.sleep(attempt, signal);
          } catch {
            break; // AbortError from sleep — stop immediately
          }
        }
      }
    }

    throw new RetryExhaustedException(lastStatus, lastErr);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private isRetryable(statusCode: number): boolean {
    if (this.config.retryOn) {
      return this.config.retryOn.includes(statusCode);
    }
    return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private isSafeToRetry(method: string): boolean {
    if (this.config.retryMethods !== undefined) {
      return this.config.retryMethods.includes(method);
    }
    return ["GET", "HEAD", "OPTIONS"].includes(method);
  }

  private sleep(attemptIndex: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const ms = this.backoffStrategy.computeDelay(attemptIndex, this.config.delay);
      const timer = setTimeout(resolve, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  }
}
