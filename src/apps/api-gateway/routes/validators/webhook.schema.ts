import { z } from "zod";

export const WebhookSchema = z
  .object({
    provider: z.enum(["github", "stripe", "custom"]),
    secret: z.string().min(1, "webhook.secret must not be empty"),
    headerName: z.string().optional(),
    hashAlgorithm: z.string().optional(),
  })
  .refine(
    (webhookConfig) =>
      webhookConfig.provider !== "custom" || webhookConfig.headerName !== undefined,
    {
      message: 'webhook.headerName is required when provider is "custom"',
      path: ["headerName"],
    },
  );
