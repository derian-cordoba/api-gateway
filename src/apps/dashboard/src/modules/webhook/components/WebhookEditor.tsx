"use client";

import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { FormField, SelectInput, TextInput } from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";
import type { WebhookConfig } from "../webhook-editor.types";
import { WebhookProviderFields } from "./WebhookProviderFields";

export function WebhookEditor({
  value,
  onChange,
}: {
  value?: WebhookConfig;
  onChange: (value?: WebhookConfig) => void;
}) {
  const config = value ?? { provider: "github" as const, secret: "" };
  const update = (patch: Partial<WebhookConfig>) => {
    onChange(omitUndefined({ ...config, ...patch }) as WebhookConfig);
  };

  return (
    <FeatureSection
      id="webhook"
      title="Webhook verification"
      description="Verify signed webhook payloads before forwarding them upstream."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="form-grid">
        <FormField label="Provider">
          <SelectInput
            value={config.provider}
            onChange={(event) => {
              const provider = event.target.value as WebhookConfig["provider"];
              update({
                provider,
                headerName:
                  provider === "custom" ? (config.headerName ?? "x-webhook-signature") : undefined,
                hashAlgorithm:
                  provider === "custom" ? (config.hashAlgorithm ?? "sha256") : undefined,
              });
            }}
          >
            <option value="github">GitHub</option>
            <option value="stripe">Stripe</option>
            <option value="custom">Custom HMAC</option>
          </SelectInput>
        </FormField>
        <FormField label="Signing secret" hint="Shared secret supplied by the webhook provider.">
          <TextInput
            type="password"
            autoComplete="new-password"
            value={config.secret}
            onChange={(event) => update({ secret: event.target.value })}
          />
        </FormField>
        <WebhookProviderFields config={config} update={update} />
      </div>
    </FeatureSection>
  );
}
