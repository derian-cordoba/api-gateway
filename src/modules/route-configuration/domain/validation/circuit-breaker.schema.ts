import { z } from "zod";
import {
  MAX_HTTP_STATUS_CODE,
  MIN_HTTP_STATUS_CODE,
} from "../../../../shared/http/httpStatusRange";

const FallbackSchema = z.object({
  status: z
    .number()
    .int()
    .min(MIN_HTTP_STATUS_CODE)
    .max(MAX_HTTP_STATUS_CODE)
    .optional(),
  body: z.unknown().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

const HealthCheckSchema = z.object({
  url: z.string().url("healthCheck.url must be a valid URL"),
  intervalMs: z
    .number()
    .int()
    .positive("healthCheck.intervalMs must be a positive integer"),
  timeoutMs: z
    .number()
    .int()
    .positive("healthCheck.timeoutMs must be a positive integer")
    .optional(),
});

export const CircuitBreakerSchema = z.object({
  threshold: z
    .number()
    .int()
    .positive("Circuit breaker threshold must be a positive integer"),
  timeout: z
    .number()
    .positive("Circuit breaker timeout must be a positive number"),
  successThreshold: z
    .number()
    .int()
    .positive("Circuit breaker successThreshold must be a positive integer")
    .optional(),
  healthCheck: HealthCheckSchema.optional(),
  fallback: FallbackSchema.optional(),
});
