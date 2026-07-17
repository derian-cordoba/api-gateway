import { Auth } from "./auth";
import { CacheConfig } from "./cache";
import { CircuitBreakerConfig } from "./circuit-breaker";
import { IpFilter } from "./ip-filter";
import { Proxy } from "./proxy";
import { RateLimit } from "./rate-limit";
import { RetryConfig } from "./retry";

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
};
