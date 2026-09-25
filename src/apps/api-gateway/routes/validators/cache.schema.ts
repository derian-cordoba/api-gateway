import { z } from "zod";
import { MAX_HTTP_STATUS_CODE, MIN_HTTP_STATUS_CODE } from "../../../../shared/http/httpStatusRange";

export const CacheSchema = z.object({
  ttl: z.number().int().min(1, "ttl must be at least 1ms"),
  methods: z.array(z.string().toUpperCase()).optional(),
  statusCodes: z
    .array(
      z
        .number()
        .int()
        .min(MIN_HTTP_STATUS_CODE, "status code must be between 100 and 599")
        .max(MAX_HTTP_STATUS_CODE, "status code must be between 100 and 599"),
    )
    .optional(),
  staleWhileRevalidateMs: z
    .number()
    .int()
    .min(1, "staleWhileRevalidateMs must be at least 1ms")
    .optional(),
  evictionIntervalMs: z
    .number()
    .int()
    .min(1000, "evictionIntervalMs must be at least 1000ms (1 second)")
    .optional(),
});
