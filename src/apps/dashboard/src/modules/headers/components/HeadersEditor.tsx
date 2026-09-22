"use client";

import type {
  GatewayRoute,
  HeaderTransform,
} from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import {
  FormField,
  KeyValueEditor,
  StringListInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";

type Config = NonNullable<GatewayRoute["headers"]>;

export function HeadersEditor({
  value,
  onChange,
}: {
  value?: Config;
  onChange: (value?: Config) => void;
}) {
  const config = value ?? { request: { set: { "X-Forwarded-By": "api-gateway" } } };
  const updateSide = (side: "request" | "response", transform?: HeaderTransform) => {
    const next = omitUndefined({ ...config, [side]: transform });
    onChange(next);
  };

  return (
    <FeatureSection
      id="headers"
      title="Header transforms"
      description="Set or remove request and response headers."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="subsection-grid">
        <TransformPanel
          title="Request headers"
          value={config.request}
          onChange={(request) => updateSide("request", request)}
        />
        <TransformPanel
          title="Response headers"
          value={config.response}
          onChange={(response) => updateSide("response", response)}
        />
      </div>
    </FeatureSection>
  );
}

function TransformPanel({
  title,
  value,
  onChange,
}: {
  title: string;
  value?: HeaderTransform;
  onChange: (value?: HeaderTransform) => void;
}) {
  return (
    <div className="nested-panel nested-panel--flush">
      <Toggle
        checked={value !== undefined}
        onChange={(enabled) => onChange(enabled ? { set: {} } : undefined)}
        label={title}
      />
      {value ? (
        <div className="stack form-grid--top-gap">
          <div>
            <h3>Set headers</h3>
            <KeyValueEditor
              value={value.set}
              onChange={(set) => onChange(omitUndefined({ ...value, set }))}
              keyPlaceholder="Header name"
            />
          </div>
          <FormField label="Remove headers">
            <StringListInput
              value={value.remove}
              onChange={(remove) => onChange(omitUndefined({ ...value, remove }))}
              placeholder="Server"
            />
          </FormField>
        </div>
      ) : null}
    </div>
  );
}
