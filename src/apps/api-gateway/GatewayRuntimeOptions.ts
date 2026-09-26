import type { Gateway } from "./types/gateway";
import type { CacheEntry } from "./middleware/cache/ResponseCache";
import type { AsyncCacheStore } from "./middleware/redis/RedisCacheStore";
import type { RateLimitStore } from "./middleware/rate-limit/RateLimitStore";
import type { AsyncCircuitBreakerStateStore } from "./middleware/redis/RedisCircuitBreakerStateStore";
import type { RouteSource } from "./routes/route-sources/RouteSource";
import type { RouteStorageManager } from "../../modules/route-configuration/infrastructure/RouteStorageManager";

/** Process-local wiring for stores that cannot be represented in routes JSON. */
export type GatewayRuntimeOptions = {
  routeSource?: RouteSource;
  routeStorageManager?: RouteStorageManager;
  cacheStoreFactory?: (route: Gateway) => AsyncCacheStore<CacheEntry>;
  rateLimitStoreFactory?: (route: Gateway) => RateLimitStore;
  circuitBreakerStoreFactory?: (route: Gateway) => AsyncCircuitBreakerStateStore;
};
