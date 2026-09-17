import { z } from "zod";

const RetryFallbackSchema = z.object({
  status: z.number().int().min(100).max(599).optional(),
  body: z.unknown().optional(),
});

export const RetrySchema = z.object({
  attempts: z
    .number()
    .int()
    .min(1, "attempts must be at least 1")
    .max(10, "attempts must not exceed 10"),
  delay: z.number().int().min(0, "delay must be non-negative"),
  backoff: z.enum(["fixed", "exponential", "exponential-jitter"]).optional(),
  retryOn: z
    .array(
      z
        .number()
        .int()
        .min(400, "retryOn status codes must be in the 400–599 range")
        .max(599, "retryOn status codes must be in the 400–599 range"),
    )
    .min(1, "retryOn must contain at least one status code")
    .optional(),
  retryMethods: z
    .array(z.string().toUpperCase())
    .min(1, "retryMethods must contain at least one HTTP method")
    .optional(),
  fallback: RetryFallbackSchema.optional(),
  collapseRequests: z.boolean().optional(),
});
