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
import { BodySerializer } from "../../middleware/retry/BodySerializer";
import { HopByHopHeaderFilter } from "../../middleware/retry/HopByHopHeaderFilter";
import { RetryExhaustedException } from "../../middleware/retry/RetryExhaustedException";

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
    );

    const selector = this.balancer
      ? new LoadBalancedTargetSelector(this.balancer)
      : new SingleTargetSelector(this.route.proxy.target!);

    const executor = new RetryExecutor(this.route.retry!, client, selector, this.breaker);

    return async (req: Request, res: Response) => {
      const body = BodySerializer.serialize(req);
      const abort = new AbortController();
      res.on("close", () => abort.abort());

      try {
        const upstream = await executor.execute(req, body, abort.signal);
        this.writeResponse(upstream, res);
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

  private writeError(err: unknown, res: Response): void {
    if (err instanceof RetryExhaustedException) {
      const status =
        err.lastStatus >= HttpStatus.INTERNAL_SERVER_ERROR
          ? err.lastStatus
          : HttpStatus.BAD_GATEWAY;
      res.status(status).json({
        error: "Bad Gateway",
        message: err.cause?.message ?? `Upstream returned ${err.lastStatus}`,
      });
      return;
    }

    res.status(HttpStatus.BAD_GATEWAY).json({
      error: "Bad Gateway",
      message: (err as Error).message ?? "Unknown upstream error",
    });
  }
}
