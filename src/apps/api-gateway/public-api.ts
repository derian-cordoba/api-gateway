/**
 * Public library API for @api-gateway/core.
 *
 * Import from this file when embedding the gateway programmatically
 * (e.g. in custom servers, integration tests, or plugin code):
 *
 * ```ts
 * import { Server, type Gateway, type CacheStore } from "@api-gateway/core";
 * ```
 *
 * The CLI entry point (`index.ts`) is separate and not part of the library surface.
 */

// ── Runtime classes ────────────────────────────────────────────────────────

export { Server } from "./Server";
export { CircuitBreaker, CircuitState } from "./middleware/circuit-breaker/CircuitBreaker";
export { HealthProber } from "./middleware/circuit-breaker/HealthProber";
export { ResponseCache } from "./middleware/cache/ResponseCache";
export { MemoryCacheStore } from "./middleware/cache/MemoryCacheStore";
export { LoadBalancer } from "./middleware/load-balancer/LoadBalancer";
export { HealthAwareSelectionStrategy } from "./middleware/load-balancer/HealthAwareSelectionStrategy";
export { RetryExecutor } from "./middleware/retry/RetryExecutor";
export { RetryExhaustedException } from "./middleware/retry/RetryExhaustedException";
export { NodeHttpUpstreamClient } from "./middleware/retry/UpstreamHttpClient";
export { BodySerializer } from "./middleware/retry/BodySerializer";
export { HopByHopHeaderFilter } from "./middleware/retry/HopByHopHeaderFilter";
export {
  SingleTargetSelector,
  LoadBalancedTargetSelector,
} from "./middleware/retry/TargetSelector";
export { FixedBackoff } from "./middleware/retry/FixedBackoff";
export { ExponentialBackoff } from "./middleware/retry/ExponentialBackoff";
export { ExponentialJitterBackoff } from "./middleware/retry/ExponentialJitterBackoff";
export { JwksKeyStore } from "./middleware/auth/JwksKeyStore";
export { AuthFailureTracker } from "./middleware/auth/AuthFailureTracker";
export { ErrorResponseFactory } from "./middleware/ErrorResponseFactory";
export { GatewayEventBus } from "./middleware/GatewayEventBus";
export { InFlightRequestCache } from "./middleware/retry/InFlightRequestCache";
export { RedisCacheStore } from "./middleware/redis/RedisCacheStore";
export { RedisRateLimitStore } from "./middleware/redis/RedisRateLimitStore";
export { RedisCircuitBreakerStateStore } from "./middleware/redis/RedisCircuitBreakerStateStore";

// ── Interfaces ─────────────────────────────────────────────────────────────

export type { CacheStore } from "./middleware/cache/CacheStore";
export type { SelectionStrategy } from "./middleware/load-balancer/SelectionStrategy";
export type { TargetSelector } from "./middleware/retry/TargetSelector";
export type {
  UpstreamHttpClient,
  UpstreamRequest,
  UpstreamResponse,
} from "./middleware/retry/UpstreamHttpClient";
export type { Clock } from "./middleware/circuit-breaker/Clock";
export type {
  CircuitBreakerStateStore,
  CircuitBreakerSnapshot,
} from "./middleware/circuit-breaker/CircuitBreakerStateStore";
export type {
  CircuitBreakerEvents,
  StateChangePayload,
} from "./middleware/circuit-breaker/CircuitBreakerEvents";
export { InMemoryStateStore } from "./middleware/circuit-breaker/InMemoryStateStore";
export type { AuthStrategy } from "./middleware/auth/AuthStrategy";
export type { IntrospectionCacheEntry, OAuth2IntrospectionResponse } from "./middleware/auth/OAuth2AuthStrategy";
export type { BackoffStrategy } from "./middleware/retry/BackoffStrategy";
export type { RateLimitStore, RateLimitIncrementResult } from "./middleware/rate-limit/RateLimitStore";
export type { GatewayErrorCode, GatewayErrorResponse } from "./middleware/ErrorResponseFactory";
export type { CacheEntryWithStaleness } from "./middleware/cache/ResponseCache";
export type { AsyncCacheStore } from "./middleware/redis/RedisCacheStore";
export type { AsyncCircuitBreakerStateStore } from "./middleware/redis/RedisCircuitBreakerStateStore";
export type { RedisClientAdapter } from "./middleware/redis/RedisCacheStore";
export type { RedisRateLimitClientAdapter } from "./middleware/redis/RedisRateLimitStore";
export type { RedisCircuitBreakerClientAdapter } from "./middleware/redis/RedisCircuitBreakerStateStore";
export type {
  GatewayEvents,
  RateLimitExceededPayload,
} from "./middleware/GatewayEvents";

// ── Key extractors ─────────────────────────────────────────────────────────

export { RequestKeyExtractorFactory } from "./middleware/key-extractors/RequestKeyExtractorFactory";
export { IpKeyExtractor } from "./middleware/key-extractors/IpKeyExtractor";
export { HeaderKeyExtractor } from "./middleware/key-extractors/HeaderKeyExtractor";
export { JwtClaimKeyExtractor } from "./middleware/key-extractors/JwtClaimKeyExtractor";
export { CookieKeyExtractor } from "./middleware/key-extractors/CookieKeyExtractor";
export { QueryParamKeyExtractor } from "./middleware/key-extractors/QueryParamKeyExtractor";
export type { RequestKeyExtractor } from "./middleware/key-extractors/RequestKeyExtractor";

// ── Configuration types ────────────────────────────────────────────────────

export type { Gateway } from "./types/gateway";
export type { Proxy, UpstreamAuthConfig, MirrorConfig, PathRewriteRules, ProxyStaticHeaders } from "./types/proxy";
export type {
  Auth,
  JwtAuth,
  ApiKeyAuth,
  BasicAuth,
  BasicAuthCredential,
  OAuth2Auth,
  AuthRateLimitConfig,
} from "./types/auth";
export type { RateLimit } from "./types/rate-limit";
export type { RetryConfig, RetryBackoff, RetryFallback } from "./types/retry";
export type { CacheConfig } from "./types/cache";
export type {
  CircuitBreakerConfig,
  CircuitBreakerFallback,
  HealthCheckConfig,
} from "./types/circuit-breaker";
export type { HeadersConfig, HeaderTransform } from "./types/headers";
export type { IpFilter } from "./types/ip-filter";
export type { RouteCors } from "./types/route-cors";
export type { BalancerStrategy, WeightedTarget } from "./types/load-balancer";
export type { CacheEntry, CacheOptions } from "./middleware/cache/ResponseCache";
export type { ValidationConfig } from "./types/validation";
export type { WebhookConfig } from "./types/webhook";
