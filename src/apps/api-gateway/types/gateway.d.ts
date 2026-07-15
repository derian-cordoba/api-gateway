import { Auth } from "./auth";
import { CircuitBreakerConfig } from "./circuit-breaker";
import { IpFilter } from "./ip-filter";
import { Proxy } from "./proxy";
import { RateLimit } from "./rate-limit";

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
};
