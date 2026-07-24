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
export { RetryExecutor } from "./middleware/retry/RetryExecutor";
export { RetryExhaustedException } from "./middleware/retry/RetryExhaustedException";
export { NodeHttpUpstreamClient } from "./middleware/retry/UpstreamHttpClient";
export { BodySerializer } from "./middleware/retry/BodySerializer";
export { HopByHopHeaderFilter } from "./middleware/retry/HopByHopHeaderFilter";
export {
  SingleTargetSelector,
  LoadBalancedTargetSelector,
} from "./middleware/retry/TargetSelector";

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
export { InMemoryStateStore } from "./middleware/circuit-breaker/InMemoryStateStore";
export type { AuthStrategy } from "./middleware/auth/AuthStrategy";
export type { IntrospectionCacheEntry } from "./middleware/auth/OAuth2AuthStrategy";

// ── Configuration types ────────────────────────────────────────────────────

export type { Gateway } from "./types/gateway";
export type { Proxy } from "./types/proxy";
export type { Auth, JwtAuth, ApiKeyAuth, BasicAuth, OAuth2Auth } from "./types/auth";
export type { RateLimit } from "./types/rate-limit";
export type { RetryConfig, RetryBackoff } from "./types/retry";
export type { CacheConfig } from "./types/cache";
export type {
  CircuitBreakerConfig,
  HealthCheckConfig,
} from "./types/circuit-breaker";
export type { HeadersConfig, HeaderTransform } from "./types/headers";
export type { IpFilter } from "./types/ip-filter";
export type { RouteCors } from "./types/route-cors";
export type { BalancerStrategy, WeightedTarget } from "./types/load-balancer";
export type { CacheEntry, CacheOptions } from "./middleware/cache/ResponseCache";
