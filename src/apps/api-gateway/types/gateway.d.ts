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
};
