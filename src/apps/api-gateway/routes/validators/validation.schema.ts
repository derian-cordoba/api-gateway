import { z } from "zod";

export const ValidationSchema = z.object({
  requiredFields: z.array(z.string().min(1)).optional(),
  allowedContentTypes: z.array(z.string().min(1)).optional(),
  maxBodyBytes: z.number().int().positive("maxBodyBytes must be a positive integer").optional(),
});
