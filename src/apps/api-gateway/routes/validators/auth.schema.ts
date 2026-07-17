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

const BasicAuthCredentialSchema = z.object({
  username: z.string().min(1, "username must not be empty"),
  password: z.string().min(1, "password must not be empty"),
});

const BasicAuthSchema = z.object({
  enabled: z.boolean(),
  strategy: z.literal("basicAuth"),
  credentials: z
    .array(BasicAuthCredentialSchema)
    .min(1, "basicAuth requires at least one credential"),
  realm: z.string().optional(),
});

export const AuthSchema = z.discriminatedUnion("strategy", [
  JwtAuthSchema,
  ApiKeyAuthSchema,
  BasicAuthSchema,
]);
