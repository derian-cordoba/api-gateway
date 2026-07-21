import type { ProxyOnHandlers } from "../ProxyManager";
import type { ProxyEventPlugin } from "./ProxyEventPlugin";

/**
 * Folds an ordered list of `ProxyEventPlugin` instances into a single
 * `ProxyOnHandlers` object accepted by http-proxy-middleware.
 *
 * Each event type (proxyReq, proxyRes, error) calls every plugin's
 * corresponding hook in array order via a flat loop — no closure chaining,
 * no captured-prev references, trivially debuggable.
 */
export class ProxyHandlerComposer {
  constructor(private readonly plugins: ProxyEventPlugin[]) {}

  compose(): ProxyOnHandlers {
    const { plugins } = this;

    return {
      proxyReq: (proxyReq, req, res) => {
        for (const plugin of plugins) plugin.onProxyReq?.(proxyReq, req, res);
      },
      proxyRes: (proxyRes, req, res) => {
        for (const plugin of plugins) plugin.onProxyRes?.(proxyRes, req, res);
      },
      error: (err, req, res) => {
        for (const plugin of plugins) plugin.onError?.(err, req, res);
      },
    };
  }
}
