import { z } from "zod";
import type { Gateway } from "../types/gateway";

const ProxySchema = z.object({
  target: z.url("Proxy target must be a valid URL"),
  isSecure: z.boolean().optional(),
  changeOrigin: z.boolean().optional(),
  pathRewrite: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  method: z.string().optional(),
  timeout: z.number().positive("Proxy timeout must be a positive number").optional(),
});

const RateLimitSchema = z.object({
  max: z.number().positive("Rate limit max must be a positive number"),
  windowMs: z.number().positive("Rate limit windowMs must be a positive number"),
  statusCode: z.number().optional(),
  message: z.string().optional(),
});

const GatewaySchema = z.object({
  baseURL: z.string().startsWith("/", "baseURL must start with /"),
  proxy: ProxySchema,
  rateLimit: RateLimitSchema.optional(),
});

export const GatewaysSchema = z.array(GatewaySchema);

export function validateRoutes(data: unknown): Gateway[] {
  const result = GatewaysSchema.safeParse(data);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  [${issue.path.join(".")}] ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid route configuration:\n${formatted}`);
  }

  return result.data as Gateway[];
}
