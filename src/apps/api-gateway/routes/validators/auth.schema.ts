import { z } from "zod";

const JwtAuthSchema = z.object({
  enabled: z.boolean(),
  strategy: z.literal("jwt"),
  secret: z.string().optional(),
  publicKey: z.string().optional(),
  algorithms: z.array(z.string()).optional(),
});

const ApiKeyAuthSchema = z.object({
  enabled: z.boolean(),
  strategy: z.literal("apiKey"),
  header: z.string().optional(),
  keys: z.array(z.string()).min(1, "apiKey auth requires at least one key"),
});

export const AuthSchema = z.discriminatedUnion("strategy", [JwtAuthSchema, ApiKeyAuthSchema]);
