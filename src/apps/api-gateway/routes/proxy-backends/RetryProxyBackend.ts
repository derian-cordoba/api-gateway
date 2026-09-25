import type { RequestHandler, Request, Response } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { Gateway } from "../../types/gateway";
import type { CircuitBreaker } from "../../middleware/circuit-breaker/CircuitBreaker";
import type { LoadBalancer } from "../../middleware/load-balancer/LoadBalancer";
import type { UpstreamResponse } from "../../middleware/retry/UpstreamHttpClient";
import type { ProxyBackend } from "./ProxyBackend";
import type { WsUpgradeHandler } from "../ProxyManager";
import { NodeHttpUpstreamClient } from "../../middleware/retry/UpstreamHttpClient";
import { SingleTargetSelector, LoadBalancedTargetSelector } from "../../middleware/retry/TargetSelector";
import { RetryExecutor } from "../../middleware/retry/RetryExecutor";
import { BackoffStrategyFactory } from "../../middleware/retry/BackoffStrategyFactory";
import { BodySerializer } from "../../middleware/retry/BodySerializer";
import { HopByHopHeaderFilter } from "../../middleware/retry/HopByHopHeaderFilter";
import { RetryExhaustedException } from "../../middleware/retry/RetryExhaustedException";
import { ErrorResponseFactory } from "../../middleware/ErrorResponseFactory";
import { logger } from "../../logger";
import { toError } from "../../../../shared/errors/toError";

/**
 * Proxy backend with automatic retry on upstream failures.
 * WebSocket upgrades are not supported by this backend.
 *
 * Composes the following collaborators (all injected/constructed here):
 *  - `NodeHttpUpstreamClient`  — makes single HTTP/HTTPS upstream calls
 *  - `SingleTargetSelector` / `LoadBalancedTargetSelector` — picks target URL
 *  - `RetryExecutor`           — orchestrates the retry loop
 *  - `BodySerializer`          — re-serializes the parsed request body
 *  - `HopByHopHeaderFilter`    — strips hop-by-hop headers before forwarding
 */
export class RetryProxyBackend implements ProxyBackend {
  constructor(
    private readonly route: Gateway,
    private readonly balancer: LoadBalancer | null,
    private readonly breaker: CircuitBreaker | null,
  ) {}

  createMiddleware(): RequestHandler {
    const client = new NodeHttpUpstreamClient(
      this.route.proxy.pathRewrite,
      this.route.headers?.request,
      this.route.proxy.upstreamAuth,
      this.route.proxy.headers,
      this.route.proxy.method,
      this.route.proxy.changeOrigin,
      this.route.proxy.isSecure,
    );

    const selector = this.balancer
      ? new LoadBalancedTargetSelector(this.balancer)
      : new SingleTargetSelector(this.route.proxy.target!);

    const executor = new RetryExecutor(
      this.route.retry!,
      client,
      selector,
      this.breaker,
      BackoffStrategyFactory.fromConfig(this.route.retry!.backoff),
    );

    return async (req: Request, res: Response) => {
      const body = BodySerializer.serialize(req);
      const abort = new AbortController();
      res.on("close", () => abort.abort());

      try {
        const upstream = await executor.execute(req, body, abort.signal);
        this.writeResponse(upstream, res);
        // Fire mirror after primary response is written — never awaited.
        this.fireMirror(req, body);
      } catch (err) {
        if (!res.headersSent) this.writeError(err, res);
      }
    };
  }

  wsUpgradeHandler(): WsUpgradeHandler | null {
    return null;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private writeResponse(upstream: UpstreamResponse, res: Response): void {
    if (res.headersSent) return;

    const forwardable = HopByHopHeaderFilter.filter(upstream.headers);
    for (const [key, value] of Object.entries(forwardable)) {
      if (value !== undefined) res.setHeader(key, value as string | string[]);
    }

    const responseHeaders = this.route.headers?.response;
    if (responseHeaders?.set) {
      for (const [key, val] of Object.entries(responseHeaders.set)) {
        res.setHeader(key, val);
      }
    }
    if (responseHeaders?.remove) {
      for (const key of responseHeaders.remove) {
        res.removeHeader(key);
      }
    }

    res.status(upstream.statusCode).end(upstream.body);
  }

  private fireMirror(req: Request, body: Buffer): void {
    const mirrorConfig = this.route.proxy.mirror;
    if (!mirrorConfig) return;

    const mirrorPercentage = mirrorConfig.percentage ?? 100;
    if (mirrorPercentage < 100 && Math.random() * 100 > mirrorPercentage) return;

    // Fire-and-forget: upstreamAuth is intentionally NOT applied to mirror requests.
    const mirrorClient = new NodeHttpUpstreamClient(this.route.proxy.pathRewrite);
    mirrorClient.send({ target: mirrorConfig.target, req, body }).catch((mirrorError: unknown) => {
      // Mirror failures must never affect primary traffic — logged at debug level only.
      logger.debug(
        { baseURL: this.route.baseURL, mirrorTarget: mirrorConfig.target, err: toError(mirrorError) },
        "Mirror request failed",
      );
    });
  }

  private writeError(err: unknown, res: Response): void {
    const retryFallback = this.route.retry?.fallback;

    if (err instanceof RetryExhaustedException) {
      if (retryFallback) {
        const responseStatus = retryFallback.status ?? HttpStatus.BAD_GATEWAY;
        if (retryFallback.body !== undefined) {
          res.status(responseStatus).json(retryFallback.body);
        } else {
          res.status(responseStatus).end();
        }
        return;
      }
      const upstreamStatus = err.lastStatus >= HttpStatus.INTERNAL_SERVER_ERROR
        ? err.lastStatus
        : HttpStatus.BAD_GATEWAY;
      res.status(upstreamStatus).json(
        ErrorResponseFactory.badGateway(err.cause?.message ?? `Upstream returned ${err.lastStatus}`),
      );
      return;
    }

    if (retryFallback) {
      const responseStatus = retryFallback.status ?? HttpStatus.BAD_GATEWAY;
      if (retryFallback.body !== undefined) {
        res.status(responseStatus).json(retryFallback.body);
      } else {
        res.status(responseStatus).end();
      }
      return;
    }

    res.status(HttpStatus.BAD_GATEWAY).json(
      ErrorResponseFactory.badGateway(toError(err).message),
    );
  }
}
