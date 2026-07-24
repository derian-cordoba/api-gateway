import { z } from "zod";

const AuthRateLimitSchema = z.object({
  max: z.number().int().positive("authRateLimit.max must be a positive integer"),
  windowMs: z.number().int().positive("authRateLimit.windowMs must be a positive number (milliseconds)"),
});

const JwtAuthSchema = z
  .object({
    enabled: z.boolean(),
    strategy: z.literal("jwt"),
    secret: z.string().optional(),
    publicKey: z.string().optional(),
    algorithms: z.array(z.string()).optional(),
    jwksUri: z.url("jwksUri must be a valid URL").optional(),
    authRateLimit: AuthRateLimitSchema.optional(),
  })
  .refine(
    (data) =>
      !data.enabled ||
      data.secret !== undefined ||
      data.publicKey !== undefined ||
      data.jwksUri !== undefined,
    {
      message: "jwt auth requires either secret (HMAC), publicKey (RSA/EC), or jwksUri (JWKS endpoint)",
      path: ["secret"],
    },
  );

const ApiKeyAuthSchema = z.object({
  enabled: z.boolean(),
  strategy: z.literal("apiKey"),
  header: z.string().optional(),
  keys: z.array(z.string()).min(1, "apiKey auth requires at least one key"),
  authRateLimit: AuthRateLimitSchema.optional(),
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
  authRateLimit: AuthRateLimitSchema.optional(),
});

const OAuth2AuthSchema = z.object({
  enabled: z.boolean(),
  strategy: z.literal("oauth2"),
  introspectionUrl: z.string().url("introspectionUrl must be a valid URL"),
  clientId: z.string().min(1, "clientId must not be empty"),
  clientSecret: z.string().min(1, "clientSecret must not be empty"),
  tokenTypeHint: z.string().optional(),
  introspectionCacheTtlMs: z
    .number()
    .int()
    .positive("introspectionCacheTtlMs must be a positive integer (milliseconds)")
    .optional(),
  authRateLimit: AuthRateLimitSchema.optional(),
});

export const AuthSchema = z.discriminatedUnion("strategy", [
  JwtAuthSchema,
  ApiKeyAuthSchema,
  BasicAuthSchema,
  OAuth2AuthSchema,
]);
