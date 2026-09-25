"use client";

import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import {
  FormField,
  NumberInput,
  StringListInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";
import type { CorsConfig } from "../cors-editor.types";
import { CorsOriginFields } from "./CorsOriginFields";

export function CorsEditor({
  value,
  onChange,
}: {
  value?: CorsConfig;
  onChange: (value?: CorsConfig) => void;
}) {
  const config = value ?? { origin: "*" };
  const update = (patch: Partial<CorsConfig>) => onChange(omitUndefined({ ...config, ...patch }));
  return (
    <FeatureSection
      id="cors"
      title="CORS"
      description="Override the global browser cross-origin policy for this route."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="form-grid">
        <CorsOriginFields config={config} update={update} />
        <FormField label="Allowed methods">
          <StringListInput
            value={config.methods}
            onChange={(methods) => update({ methods })}
            placeholder="GET, POST, OPTIONS"
          />
        </FormField>
        <FormField label="Allowed headers">
          <StringListInput
            value={config.allowedHeaders}
            onChange={(allowedHeaders) => update({ allowedHeaders })}
            placeholder="Content-Type, Authorization"
          />
        </FormField>
        <FormField label="Preflight max age" hint="Seconds">
          <NumberInput min={1} value={config.maxAge} onValue={(maxAge) => update({ maxAge })} />
        </FormField>
        <div className="form-field form-field--toggle">
          <Toggle
            checked={config.credentials ?? false}
            onChange={(credentials) => update({ credentials })}
            label="Allow credentials"
          />
        </div>
      </div>
      {config.credentials && config.origin === "*" && (
        <div className="inline-warning">
          Credentialed CORS cannot use a wildcard origin. Choose an explicit origin or reflect the
          request origin.
        </div>
      )}
    </FeatureSection>
  );
}
