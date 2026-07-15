import type { WeightedTarget, BalancerStrategy } from "./load-balancer";

export declare type Proxy = {
  /**
   * The target URL to proxy requests to.
   * Exactly one of `target` or `targets` is required.
   * Mutually exclusive with `targets`.
   */
  target?: string;

  /**
   * List of upstream targets for load-balanced routing.
   * Exactly one of `target` or `targets` is required.
   * Mutually exclusive with `target`. Requires at least two entries.
   */
  targets?: WeightedTarget[];

  /**
   * Load balancing strategy to use when `targets` is set.
   * Defaults to "round-robin" when omitted.
   * Only valid when `targets` is set.
   */
  strategy?: BalancerStrategy;

  /**
   * Determine if the proxy route should be secure.
   */
  isSecure?: boolean;

  /**
   * Change the origin of the host header to the target URL.
   */
  changeOrigin?: boolean;

  /**
   * Path rewriting rules for the proxy.
   */
  pathRewrite?: {
    /**
     * The path to rewrite the request URL.
     */
    [key: string]: string;
  };

  /**
   * Headers to add to the request.
   */
  headers?: {
    /**
     * The name of the header.
     */
    [key: string]: string;
  };

  /**
   * The HTTP method to use for the request.
   */
  method?: string;

  /**
   * The timeout for the request in milliseconds.
   */
  timeout?: number;

  /**
   * When true, WebSocket upgrade requests are proxied to the upstream.
   * The middleware's upgrade handler is attached to the raw HTTP server.
   */
  ws?: boolean;
};
