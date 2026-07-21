import { z } from "zod";

const HeaderTransformSchema = z
  .object({
    set: z.record(z.string(), z.string()).optional(),
    remove: z.array(z.string()).optional(),
  })
  .refine(
    (v) => v.set !== undefined || v.remove !== undefined,
    "header transform must specify at least 'set' or 'remove'",
  );

export const HeadersSchema = z
  .object({
    request: HeaderTransformSchema.optional(),
    response: HeaderTransformSchema.optional(),
  })
  .refine(
    (v) => v.request !== undefined || v.response !== undefined,
    "headers must specify at least 'request' or 'response'",
  );
