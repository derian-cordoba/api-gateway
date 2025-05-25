export declare type RateLimit = {
  /**
   * The maximum number of requests allowed within the specified time window.
   */
  max: number;

  /**
   * The time window in milliseconds for which the rate limit applies.
   */
  windowMs: number;

  /**
   * The HTTP status code to return when the rate limit is exceeded.
   */
  statusCode?: number;

  /**
   * The message to return when the rate limit is exceeded.
   */
  message?: string;
};
