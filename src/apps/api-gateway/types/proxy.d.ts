import type { WeightedTarget, BalancerStrategy } from "./load-balancer";

/** Regex-pattern-to-replacement-string map for rewriting upstream request paths. */
export declare type PathRewriteRules = Record<string, string>;

/** Static headers added to every upstream request on this route. */
export declare type ProxyStaticHeaders = Record<string, string>;

export declare type UpstreamAuthConfig = {
  /**
   * The signing algorithm. Currently only "hmac-sha256" is supported.
   */
  type: "hmac-sha256";
  /**
   * Shared secret known to the gateway and the upstream service.
   */
  secret: string;
  /**
   * Name of the request header that will carry the signature.
   * Defaults to "x-gateway-signature".
   */
  header?: string;
};

export declare type MirrorConfig = {
  /**
   * The target URL to mirror traffic to.
   */
  target: string;
  /**
   * Percentage of requests to mirror, as a number between 0 and 100.
   * Defaults to 100 (mirror every request).
   */
  percentage?: number;
};

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
   * Key source used by the "sticky" strategy to derive a session identifier.
   *
   * - `"cookie:<name>"` — a request cookie (e.g. `"cookie:JSESSIONID"`)
   * - `"header:<name>"` — a request header (e.g. `"header:X-Session-ID"`)
   *
   * Only valid when `strategy` is `"sticky"`.
   */
  stickyKey?: string;

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
   * Each key is a regex pattern matched against the request path; the value
   * is the replacement string (supports capture groups).
   */
  pathRewrite?: PathRewriteRules;

  /**
   * Static headers added to every upstream request on this route.
   */
  headers?: ProxyStaticHeaders;

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

  /**
   * HMAC-based authentication for outgoing upstream requests.
   * When configured, the gateway adds a signature header to every upstream
   * request so the upstream can verify the request was forwarded by the gateway.
   */
  upstreamAuth?: UpstreamAuthConfig;

  /**
   * Shadow traffic configuration.
   * When set, a percentage of requests are duplicated and forwarded to a
   * secondary target in a fire-and-forget fashion. The mirror response is
   * discarded. This never affects the primary response or latency.
   *
   * Only supported when the route uses the retry backend (i.e. `retry` is set).
   */
  mirror?: MirrorConfig;
};
