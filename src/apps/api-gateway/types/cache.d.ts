export declare type CacheConfig = {
  /**
   * Time-to-live in milliseconds. Cached entries are served until this
   * duration elapses after the first upstream response.
   */
  ttl: number;

  /**
   * HTTP methods to cache. Only safe, idempotent methods make sense here.
   * @default ["GET", "HEAD"]
   */
  methods?: string[];

  /**
   * HTTP status codes whose responses should be cached.
   * @default [200, 203, 204]
   */
  statusCodes?: number[];
};
