"use client";

import { FormField, NumberInput, Toggle } from "@/modules/shared/components/FormControls";
import type { UpdateWebhook, WebhookConfig } from "../webhook-editor.types";

type StripeWebhookConfig = Extract<WebhookConfig, { provider: "stripe" }>;

export function StripeWebhookFields({
  config,
  update,
}: {
  config: StripeWebhookConfig;
  update: UpdateWebhook;
}) {
  return (
    <>
      <FormField label="Timestamp tolerance" hint="Seconds; defaults to 300.">
        <NumberInput
          min={1}
          value={config.toleranceSeconds}
          onValue={(toleranceSeconds) => update({ toleranceSeconds })}
        />
      </FormField>
      <Toggle
        checked={config.replayProtection ?? false}
        onChange={(replayProtection) => update({ replayProtection })}
        label="Reject replayed signatures"
      />
    </>
  );
}
