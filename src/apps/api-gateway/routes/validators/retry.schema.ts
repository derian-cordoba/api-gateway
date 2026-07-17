import { z } from "zod";

export const RetrySchema = z.object({
  attempts: z.number().int().min(1, "attempts must be at least 1"),
  delay: z.number().int().min(0, "delay must be non-negative"),
  backoff: z.enum(["fixed", "exponential"]).optional(),
});
