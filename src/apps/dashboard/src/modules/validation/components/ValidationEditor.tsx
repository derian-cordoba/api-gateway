"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { FormField, NumberInput, StringListInput } from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";

type Config = NonNullable<GatewayRoute["validation"]>;

export function ValidationEditor({
  value,
  onChange,
}: {
  value?: Config;
  onChange: (value?: Config) => void;
}) {
  const config = value ?? { allowedContentTypes: ["application/json"] };
  const update = (patch: Partial<Config>) => onChange(omitUndefined({ ...config, ...patch }));

  return (
    <FeatureSection
      id="validation"
      title="Request validation"
      description="Reject oversized or malformed request bodies before they reach the upstream."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="form-grid">
        <FormField label="Required body fields" hint="Top-level JSON fields, one per line.">
          <StringListInput
            value={config.requiredFields}
            onChange={(requiredFields) => update({ requiredFields })}
            placeholder={"customerId\namount"}
          />
        </FormField>
        <FormField label="Allowed content types" hint="Case-insensitive content-type matches.">
          <StringListInput
            value={config.allowedContentTypes}
            onChange={(allowedContentTypes) => update({ allowedContentTypes })}
            placeholder={"application/json\napplication/x-www-form-urlencoded"}
          />
        </FormField>
        <FormField
          label="Maximum body size"
          hint="Bytes. Requests with a larger Content-Length return 413."
        >
          <NumberInput
            min={1}
            value={config.maxBodyBytes}
            onValue={(maxBodyBytes) => update({ maxBodyBytes })}
            placeholder="1048576"
          />
        </FormField>
      </div>
    </FeatureSection>
  );
}
