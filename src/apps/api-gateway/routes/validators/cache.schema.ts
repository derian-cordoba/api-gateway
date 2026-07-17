import { z } from "zod";

export const CacheSchema = z.object({
  ttl: z.number().int().min(1, "ttl must be at least 1ms"),
  methods: z.array(z.string().toUpperCase()).optional(),
  statusCodes: z.array(z.number().int()).optional(),
});
