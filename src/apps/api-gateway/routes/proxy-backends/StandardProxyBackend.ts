import type { Options, RequestHandler as HttpProxyMiddlewareHandler } from "http-proxy-middleware";
import type { RequestHandler } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { Gateway } from "../../types/gateway";
import type { CircuitBreaker } from "../../middleware/circuit-breaker/CircuitBreaker";
import type { LoadBalancer } from "../../middleware/load-balancer/LoadBalancer";
import type { ProxyBackend } from "./ProxyBackend";
import type { WsUpgradeHandler } from "../ProxyManager";
import { ProxyHandlerComposer } from "../proxy-event-plugins/ProxyHandlerComposer";
import { FixRequestBodyPlugin } from "../proxy-event-plugins/FixRequestBodyPlugin";
import { RequestHeaderTransformPlugin } from "../proxy-event-plugins/RequestHeaderTransformPlugin";
import { ResponseHeaderTransformPlugin } from "../proxy-event-plugins/ResponseHeaderTransformPlugin";
import { CircuitBreakerPlugin } from "../proxy-event-plugins/CircuitBreakerPlugin";
import { LoadBalancerPlugin } from "../proxy-event-plugins/LoadBalancerPlugin";

/**
 * Standard http-proxy-middleware backend with a composable plugin pipeline.
 *
 * Plugin execution order:
 *  1. FixRequestBodyPlugin          — re-serialise parsed body onto the request
 *  2. RequestHeaderTransformPlugin  — set/remove outgoing request headers (if configured)
 *  3. CircuitBreakerPlugin          — record upstream success/failure (if configured)
 *  4. LoadBalancerPlugin            — decrement connection count on close (if configured)
 *  5. ResponseHeaderTransformPlugin — set/remove response headers (if configured)
 *
 * The middleware instance is cached after `createMiddleware()` so that
 * `wsUpgradeHandler()` can return the `.upgrade` function attached to it.
 * Both methods must be called in that order by `RouteRegistrar`.
 */
export class StandardProxyBackend implements ProxyBackend {
  /**
   * Cached after `createMiddleware()` is called.
   * http-proxy-middleware's `RequestHandler` types the `.upgrade` method directly,
   * so no unsafe cast is required to retrieve it.
   */
  private proxyHandler: HttpProxyMiddlewareHandler | null = null;

  constructor(
    private readonly route: Gateway,
    private readonly breaker: CircuitBreaker | null,
    private readonly balancer: LoadBalancer | null,
  ) {}

  createMiddleware(): RequestHandler {
    const plugins = [
      new FixRequestBodyPlugin(),
      ...(this.route.headers?.request
        ? [new RequestHeaderTransformPlugin(this.route.headers.request)]
        : []),
      ...(this.breaker ? [new CircuitBreakerPlugin(this.breaker)] : []),
      ...(this.balancer ? [new LoadBalancerPlugin(this.balancer)] : []),
      ...(this.route.headers?.response
        ? [new ResponseHeaderTransformPlugin(this.route.headers.response)]
        : []),
    ];

    // Explicitly forward only the proxy fields that map to http-proxy-middleware
    // Options. Fields handled elsewhere (target/targets/strategy → balancer,
    // timeout → proxyTimeout) are set below rather than spread to keep the
    // construction deterministic and free of side-channel properties.
    const options: Options = {
      changeOrigin: this.route.proxy.changeOrigin,
      pathRewrite: this.route.proxy.pathRewrite,
      headers: this.route.proxy.headers,
      method: this.route.proxy.method,
      ws: this.route.proxy.ws,
      on: new ProxyHandlerComposer(plugins).compose(),
    };

    if (this.route.proxy.timeout !== undefined) {
      options.proxyTimeout = this.route.proxy.timeout;
    }

    if (this.balancer) {
      options.router = this.balancer.createRouterFn();
    } else {
      options.target = this.route.proxy.target;
    }

    this.proxyHandler = createProxyMiddleware(options);
    return this.proxyHandler as RequestHandler;
  }

  wsUpgradeHandler(): WsUpgradeHandler | null {
    if (!this.route.proxy.ws || !this.proxyHandler) return null;
    return this.proxyHandler.upgrade as WsUpgradeHandler;
  }
}
