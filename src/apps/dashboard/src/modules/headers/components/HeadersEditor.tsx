"use client";

import type {
  GatewayRoute,
  HeaderTransform,
} from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { omitUndefined } from "@shared/objects/omitUndefined";
import { TransformPanel } from "./TransformPanel";

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
