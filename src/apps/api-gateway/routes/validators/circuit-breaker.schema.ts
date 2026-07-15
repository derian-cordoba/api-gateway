import { z } from "zod";

export const CircuitBreakerSchema = z.object({
  threshold: z.number().int().positive("Circuit breaker threshold must be a positive integer"),
  timeout: z.number().positive("Circuit breaker timeout must be a positive number"),
  successThreshold: z
    .number()
    .int()
    .positive("Circuit breaker successThreshold must be a positive integer")
    .optional(),
});
