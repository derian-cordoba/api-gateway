/**
 * Tunable defaults for proxy-layer behaviour.
 *
 * All values can be overridden via environment variables so operators can
 * adjust behaviour at deploy time without code changes.
 */

import { EnvParser } from "../EnvParser";

const {
  METRICS_HISTOGRAM_BUCKETS,
  ROUTES_DEBOUNCE_MS,
  RETRY_BACKOFF_MULTIPLIER,
  CIRCUIT_BREAKER_SUCCESS_THRESHOLD,
  CACHE_DEFAULT_METHODS,
  CACHE_DEFAULT_STATUS_CODES,
} = process.env;

export type ProxyConfig = {
  /** Prometheus histogram bucket boundaries for request duration (seconds). */
  metricsHistogramBuckets: number[];
  /** Debounce window (ms) before a file-watcher change triggers a route reload. */
  routesDebounceMs: number;
  /** Base multiplier for exponential backoff: `delay * multiplier^attempt`. */
  retryBackoffMultiplier: number;
  /** Number of consecutive successes in HALF_OPEN to close the circuit. */
  circuitBreakerSuccessThreshold: number;
  /** HTTP methods cached by default when a route enables caching. */
  cacheDefaultMethods: string[];
  /** HTTP status codes cached by default when a route enables caching. */
  cacheDefaultStatusCodes: number[];
};

export const proxyConfig: ProxyConfig = {
  metricsHistogramBuckets: EnvParser.positiveBuckets(
    METRICS_HISTOGRAM_BUCKETS,
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ),
  routesDebounceMs:              EnvParser.positiveInt(ROUTES_DEBOUNCE_MS, 300),
  retryBackoffMultiplier:        EnvParser.positiveFloat(RETRY_BACKOFF_MULTIPLIER, 2),
  circuitBreakerSuccessThreshold: EnvParser.positiveInt(CIRCUIT_BREAKER_SUCCESS_THRESHOLD, 1),
  cacheDefaultMethods:           EnvParser.httpMethods(CACHE_DEFAULT_METHODS, ["GET", "HEAD"]),
  cacheDefaultStatusCodes:       EnvParser.httpStatusCodes(CACHE_DEFAULT_STATUS_CODES, [200, 203, 204]),
};
