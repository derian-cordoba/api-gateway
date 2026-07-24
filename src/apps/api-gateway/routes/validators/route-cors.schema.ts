import { z } from "zod";

export const RouteCorsSchema = z
  .object({
    origin: z.union([z.string(), z.array(z.string()), z.boolean()]),
    methods: z.array(z.string()).optional(),
    allowedHeaders: z.array(z.string()).optional(),
    credentials: z.boolean().optional(),
    maxAge: z.number().int().positive().optional(),
  })
  .refine(
    (d) => !(d.credentials === true && d.origin === "*"),
    {
      message:
        'credentials: true cannot be combined with origin: "*" (browsers reject credentialed wildcard CORS)',
      path: ["credentials"],
    },
  );
