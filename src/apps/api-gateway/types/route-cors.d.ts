export declare type RouteCors = {
  /**
   * Allowed origin(s) for this route.
   * - A single origin string: "https://app.example.com"
   * - An array of origins: ["https://app.example.com", "https://admin.example.com"]
   * - `true` to reflect the request Origin header (same as "*" but supports credentials)
   * - `false` to disable CORS for this route
   */
  origin: string | string[] | boolean;

  /**
   * HTTP methods allowed for this route. Defaults to the global CORS_METHODS config.
   */
  methods?: string[];

  /**
   * Request headers allowed for this route. Defaults to the global CORS_HEADERS config.
   */
  allowedHeaders?: string[];

  /**
   * Whether to include credentials (cookies, Authorization) in cross-origin requests.
   * When true, `origin` must not be `"*"` (use an explicit domain instead).
   */
  credentials?: boolean;

  /**
   * How long (in seconds) the browser may cache the preflight response.
   */
  maxAge?: number;
};
