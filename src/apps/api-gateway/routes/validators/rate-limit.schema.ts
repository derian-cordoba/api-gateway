import { z } from "zod";
import { MAX_HTTP_STATUS_CODE, MIN_HTTP_ERROR_STATUS_CODE } from "../../../../shared/http/httpStatusRange";

/**
 * Valid formats for keyBy:
 *   "ip"
 *   "header:<name>"
 *   "jwt:<claim>"
 *   "cookie:<name>"
 *   "query:<name>"
 */
const KEY_BY_PATTERN = /^(ip|header:[^:]+|jwt:[^:]+|cookie:[^:]+|query:[^:]+)$/;

export const RateLimitSchema = z.object({
  max: z.number().positive("Rate limit max must be a positive number"),
  windowMs: z.number().positive("Rate limit windowMs must be a positive number"),
  statusCode: z
    .number()
    .int()
    .min(MIN_HTTP_ERROR_STATUS_CODE, "statusCode must be a 4xx or 5xx HTTP status code")
    .max(MAX_HTTP_STATUS_CODE, "statusCode must be a 4xx or 5xx HTTP status code")
    .optional(),
  message: z.string().optional(),
  keyBy: z
    .string()
    .regex(
      KEY_BY_PATTERN,
      'keyBy must be "ip", "header:<name>", "jwt:<claim>", "cookie:<name>", or "query:<name>"',
    )
    .optional(),
});
