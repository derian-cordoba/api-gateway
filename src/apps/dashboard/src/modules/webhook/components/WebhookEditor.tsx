"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { FormField, SelectInput, TextInput } from "@/modules/shared/components/FormControls";

type Config = NonNullable<GatewayRoute["webhook"]>;

export function WebhookEditor({ value, onChange }: { value?: Config; onChange: (value?: Config) => void }) {
  const config = value ?? { provider: "github" as const, secret: "" };
  const update = (patch: Partial<Config>) => onChange({ ...config, ...patch });

  return <FeatureSection
    id="webhook"
    title="Webhook verification"
    description="Verify signed webhook payloads before forwarding them upstream."
    enabled={value !== undefined}
    onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
  >
    <div className="form-grid">
      <FormField label="Provider">
        <SelectInput value={config.provider} onChange={(event) => {
          const provider = event.target.value as Config["provider"];
          update({ provider, headerName: provider === "custom" ? config.headerName ?? "x-webhook-signature" : undefined, hashAlgorithm: provider === "custom" ? config.hashAlgorithm ?? "sha256" : undefined });
        }}>
          <option value="github">GitHub</option>
          <option value="stripe">Stripe</option>
          <option value="custom">Custom HMAC</option>
        </SelectInput>
      </FormField>
      <FormField label="Signing secret" hint="Shared secret supplied by the webhook provider.">
        <TextInput type="password" autoComplete="new-password" value={config.secret} onChange={(event) => update({ secret: event.target.value })} />
      </FormField>
      {config.provider === "custom" ? <>
        <FormField label="Signature header">
          <TextInput value={config.headerName ?? ""} onChange={(event) => update({ headerName: event.target.value || undefined })} placeholder="x-webhook-signature" />
        </FormField>
        <FormField label="Hash algorithm" hint="Any HMAC algorithm supported by Node.js crypto.">
          <TextInput value={config.hashAlgorithm ?? ""} onChange={(event) => update({ hashAlgorithm: event.target.value || undefined })} placeholder="sha256" />
        </FormField>
      </> : null}
    </div>
  </FeatureSection>;
}
