import { z } from "zod";

const GitHubWebhookSchema = z.object({
  provider: z.literal("github"),
  secret: z.string().min(1, "webhook.secret must not be empty"),
  headerName: z.string().optional(),
  hashAlgorithm: z.string().optional(),
});

const StripeWebhookSchema = z.object({
  provider: z.literal("stripe"),
  secret: z.string().min(1, "webhook.secret must not be empty"),
  headerName: z.string().optional(),
  hashAlgorithm: z.string().optional(),
  toleranceSeconds: z.number().int().positive().optional(),
  replayProtection: z.boolean().optional(),
});

const CustomWebhookSchema = z.object({
  provider: z.literal("custom"),
  secret: z.string().min(1, "webhook.secret must not be empty"),
  headerName: z.string().min(1, 'webhook.headerName is required when provider is "custom"'),
  hashAlgorithm: z.string().optional(),
});

export const WebhookSchema = z.discriminatedUnion("provider", [
  GitHubWebhookSchema,
  StripeWebhookSchema,
  CustomWebhookSchema,
]);
