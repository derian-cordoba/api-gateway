import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { CircuitBreaker } from "../../middleware/circuit-breaker/CircuitBreaker";
import type { LoadBalancer } from "../../middleware/load-balancer/LoadBalancer";
import type { ProxyBackend } from "./ProxyBackend";
import type { WsUpgradeHandler } from "../ProxyManager";
import { createRetryProxyMiddleware } from "../../middleware/retry/RetryProxyMiddleware";

/** Thin wrapper around the custom retry proxy. WebSocket upgrades are not supported. */
export class RetryProxyBackend implements ProxyBackend {
  constructor(
    private readonly route: Gateway,
    private readonly balancer: LoadBalancer | null,
    private readonly breaker: CircuitBreaker | null,
  ) {}

  createMiddleware(): RequestHandler {
    return createRetryProxyMiddleware(
      this.route.retry!,
      this.route.proxy.target,
      this.route.proxy.pathRewrite,
      this.balancer,
      this.breaker,
      this.route.headers,
    );
  }

  wsUpgradeHandler(): WsUpgradeHandler | null {
    return null;
  }
}
