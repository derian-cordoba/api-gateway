"use client";

import { FormField, TextInput } from "@/modules/shared/components/FormControls";
import type { UpdateWebhook, WebhookConfig } from "../webhook-editor.types";

type CustomWebhookConfig = Extract<WebhookConfig, { provider: "custom" }>;

export function CustomWebhookFields({
  config,
  update,
}: {
  config: CustomWebhookConfig;
  update: UpdateWebhook;
}) {
  return (
    <>
      <FormField label="Signature header">
        <TextInput
          value={config.headerName ?? ""}
          onChange={(event) => update({ headerName: event.target.value || undefined })}
          placeholder="x-webhook-signature"
        />
      </FormField>
      <FormField label="Hash algorithm" hint="Any HMAC algorithm supported by Node.js crypto.">
        <TextInput
          value={config.hashAlgorithm ?? ""}
          onChange={(event) => update({ hashAlgorithm: event.target.value || undefined })}
          placeholder="sha256"
        />
      </FormField>
    </>
  );
}
