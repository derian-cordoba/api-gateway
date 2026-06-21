import { Auth } from "./auth";
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
};
