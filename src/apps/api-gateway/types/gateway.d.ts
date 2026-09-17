import { Auth } from "./auth";
import { CacheConfig } from "./cache";
import { CircuitBreakerConfig } from "./circuit-breaker";
import { HeadersConfig } from "./headers";
import { IpFilter } from "./ip-filter";
import { Proxy } from "./proxy";
import { RateLimit } from "./rate-limit";
import { RetryConfig } from "./retry";
import { RouteCors } from "./route-cors";
import type { ValidationConfig } from "./validation";
import type { WebhookConfig } from "./webhook";

export declare type Gateway = {
  /**
   * The base URL for the proxy route.
   */
  baseURL: string;

  /**
   * Proxy configuration for the route.
   */
  proxy: Proxy;

  /**
   * Rate limiting configuration for the route.
   */
  rateLimit?: RateLimit;

  /**
   * Authentication configuration for the route.
   * When omitted or `enabled: false`, no authentication is applied.
   */
  auth?: Auth;

  /**
   * Circuit breaker configuration for the route.
   * When configured, the gateway stops forwarding requests to a failing upstream
   * and returns 503 until the service recovers.
   */
  circuitBreaker?: CircuitBreakerConfig;

  /**
   * IP allowlist / blocklist for the route.
   * `deny` is evaluated first; a match returns 403.
   * `allow` restricts access to listed IPs/CIDR ranges only.
   * At least one of `allow` or `deny` must be provided when set.
   */
  ipFilter?: IpFilter;

  /**
   * Retry configuration for failed upstream requests.
   * When set, the gateway will retry on 5xx responses or network errors
   * before returning an error to the client.
   */
  retry?: RetryConfig;

  /**
   * In-memory response cache configuration.
   * When set, successful upstream responses are cached for the given TTL
   * and served directly on cache hits without proxying.
   */
  cache?: CacheConfig;

  /**
   * Header transformation rules for this route.
   * `request` transforms are applied to the outgoing request sent to the upstream.
   * `response` transforms are applied to the response returned to the client.
   */
  headers?: HeadersConfig;

  /**
   * Route-level CORS policy. Overrides the global CORS configuration for this
   * route, including preflight (OPTIONS) handling.
   * When omitted, OPTIONS requests are forwarded to the upstream.
   */
  cors?: RouteCors;

  /**
   * Request body validation rules applied before the request is proxied.
   * Returns 422/415/413 to the client when validation fails — the upstream
   * never sees an invalid request.
   */
  validation?: ValidationConfig;

  /**
   * Inbound webhook signature verification.
   * When configured, the gateway verifies the HMAC signature on the request
   * before forwarding it. Returns 401 when verification fails.
   */
  webhook?: WebhookConfig;
};
