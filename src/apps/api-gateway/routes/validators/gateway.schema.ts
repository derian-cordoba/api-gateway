import { z } from "zod";
import { AuthSchema } from "./auth.schema";
import { CacheSchema } from "./cache.schema";
import { CircuitBreakerSchema } from "./circuit-breaker.schema";
import { HeadersSchema } from "./headers.schema";
import { IpFilterSchema } from "./ip-filter.schema";
import { ProxySchema } from "./proxy.schema";
import { RateLimitSchema } from "./rate-limit.schema";
import { RetrySchema } from "./retry.schema";
import { RouteCorsSchema } from "./route-cors.schema";

export const GatewaySchema = z.object({
  baseURL: z.string().startsWith("/", "baseURL must start with /"),
  proxy: ProxySchema,
  rateLimit: RateLimitSchema.optional(),
  auth: AuthSchema.optional(),
  circuitBreaker: CircuitBreakerSchema.optional(),
  ipFilter: IpFilterSchema.optional(),
  retry: RetrySchema.optional(),
  cache: CacheSchema.optional(),
  headers: HeadersSchema.optional(),
  cors: RouteCorsSchema.optional(),
});

export const GatewaysSchema = z.array(GatewaySchema);
