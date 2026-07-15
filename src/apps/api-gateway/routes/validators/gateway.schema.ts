import { z } from "zod";
import { AuthSchema } from "./auth.schema";
import { CircuitBreakerSchema } from "./circuit-breaker.schema";
import { IpFilterSchema } from "./ip-filter.schema";
import { ProxySchema } from "./proxy.schema";
import { RateLimitSchema } from "./rate-limit.schema";

export const GatewaySchema = z.object({
  baseURL: z.string().startsWith("/", "baseURL must start with /"),
  proxy: ProxySchema,
  rateLimit: RateLimitSchema.optional(),
  auth: AuthSchema.optional(),
  circuitBreaker: CircuitBreakerSchema.optional(),
  ipFilter: IpFilterSchema.optional(),
});

export const GatewaysSchema = z.array(GatewaySchema);
