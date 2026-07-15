import { z } from "zod";

export const RateLimitSchema = z.object({
  max: z.number().positive("Rate limit max must be a positive number"),
  windowMs: z.number().positive("Rate limit windowMs must be a positive number"),
  statusCode: z.number().optional(),
  message: z.string().optional(),
});
