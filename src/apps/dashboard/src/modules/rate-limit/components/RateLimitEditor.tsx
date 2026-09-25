"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { MAX_HTTP_STATUS_CODE, MIN_HTTP_ERROR_STATUS_CODE } from "@shared/http/httpStatusRange";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { FormField, NumberInput, TextInput } from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";

type Config = NonNullable<GatewayRoute["rateLimit"]>;

export function RateLimitEditor({
  value,
  onChange,
}: {
  value?: Config;
  onChange: (value?: Config) => void;
}) {
  const config = value ?? { max: 100, windowMs: 60_000 };
  const update = (patch: Partial<Config>) => onChange(omitUndefined({ ...config, ...patch }));
  return (
    <FeatureSection
      id="rateLimit"
      title="Rate limiting"
      description="Control request volume for this route."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="form-grid">
        <FormField label="Request limit">
          <NumberInput min={1} value={config.max} onValue={(max) => update({ max: max ?? 1 })} />
        </FormField>
        <FormField label="Window" hint="Milliseconds">
          <NumberInput
            min={1}
            value={config.windowMs}
            onValue={(windowMs) => update({ windowMs: windowMs ?? 1 })}
          />
        </FormField>
        <FormField label="Key source" hint="ip, header:name, jwt:claim, cookie:name, or query:name">
          <TextInput
            value={config.keyBy ?? ""}
            onChange={(event) => update({ keyBy: event.target.value || undefined })}
            placeholder="ip"
          />
        </FormField>
        <FormField label="Response status">
          <NumberInput
            min={MIN_HTTP_ERROR_STATUS_CODE}
            max={MAX_HTTP_STATUS_CODE}
            value={config.statusCode}
            onValue={(statusCode) => update({ statusCode })}
            placeholder="429"
          />
        </FormField>
        <FormField label="Response message" wide>
          <TextInput
            value={config.message ?? ""}
            onChange={(event) => update({ message: event.target.value || undefined })}
            placeholder="Too many requests"
          />
        </FormField>
      </div>
    </FeatureSection>
  );
}
