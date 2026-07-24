import { z } from "zod";

/**
 * Valid formats for keyBy:
 *   "ip"
 *   "header:<name>"
 *   "jwt:<claim>"
 */
const KEY_BY_PATTERN = /^(ip|header:[^:]+|jwt:[^:]+)$/;

export const RateLimitSchema = z.object({
  max: z.number().positive("Rate limit max must be a positive number"),
  windowMs: z.number().positive("Rate limit windowMs must be a positive number"),
  statusCode: z
    .number()
    .int()
    .min(400, "statusCode must be a 4xx or 5xx HTTP status code")
    .max(599, "statusCode must be a 4xx or 5xx HTTP status code")
    .optional(),
  message: z.string().optional(),
  keyBy: z
    .string()
    .regex(
      KEY_BY_PATTERN,
      'keyBy must be "ip", "header:<name>", or "jwt:<claim>"',
    )
    .optional(),
});
