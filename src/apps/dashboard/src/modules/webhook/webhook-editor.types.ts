import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export type WebhookConfig = NonNullable<GatewayRoute["webhook"]>;
export type UpdateWebhook = (patch: Partial<WebhookConfig>) => void;
