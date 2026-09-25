"use client";

import type { WebhookConfig, UpdateWebhook } from "../webhook-editor.types";
import { CustomWebhookFields } from "./CustomWebhookFields";
import { StripeWebhookFields } from "./StripeWebhookFields";

export function WebhookProviderFields({
  config,
  update,
}: {
  config: WebhookConfig;
  update: UpdateWebhook;
}) {
  return (
    <>
      {config.provider === "stripe" && <StripeWebhookFields config={config} update={update} />}
      {config.provider === "custom" && <CustomWebhookFields config={config} update={update} />}
    </>
  );
}
