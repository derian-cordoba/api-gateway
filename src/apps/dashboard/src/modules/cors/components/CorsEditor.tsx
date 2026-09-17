"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import {
  FormField,
  NumberInput,
  SelectInput,
  StringListInput,
  TextInput,
  Toggle,
} from "@/modules/shared/components/FormControls";

type Config = NonNullable<GatewayRoute["cors"]>;
type OriginMode = "single" | "multiple" | "reflect" | "disabled";

export function CorsEditor({
  value,
  onChange,
}: {
  value?: Config;
  onChange: (value?: Config) => void;
}) {
  const config = value ?? { origin: "*" };
  const update = (patch: Partial<Config>) => onChange({ ...config, ...patch });
  const mode: OriginMode = Array.isArray(config.origin)
    ? "multiple"
    : config.origin === true
      ? "reflect"
      : config.origin === false
        ? "disabled"
        : "single";

  const changeMode = (next: OriginMode) =>
    update({
      origin:
        next === "multiple"
          ? ["https://app.example.com"]
          : next === "reflect"
            ? true
            : next === "disabled"
              ? false
              : "*",
    });

  return (
    <FeatureSection
      id="cors"
      title="CORS"
      description="Override the global browser cross-origin policy for this route."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="form-grid">
        <FormField label="Origin mode">
          <SelectInput
            value={mode}
            onChange={(event) => changeMode(event.target.value as OriginMode)}
          >
            <option value="single">Single origin</option>
            <option value="multiple">Origin allowlist</option>
            <option value="reflect">Reflect request origin</option>
            <option value="disabled">Disable CORS</option>
          </SelectInput>
        </FormField>
        {mode === "single" ? (
          <FormField label="Allowed origin">
            <TextInput
              value={typeof config.origin === "string" ? config.origin : "*"}
              onChange={(event) => update({ origin: event.target.value })}
            />
          </FormField>
        ) : null}
        {mode === "multiple" ? (
          <FormField label="Allowed origins">
            <StringListInput
              value={Array.isArray(config.origin) ? config.origin : []}
              onChange={(origin) => update({ origin: origin ?? [] })}
            />
          </FormField>
        ) : null}
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
      {config.credentials && config.origin === "*" ? (
        <div className="inline-warning">
          Credentialed CORS cannot use a wildcard origin. Choose an explicit origin or reflect the
          request origin.
        </div>
      ) : null}
    </FeatureSection>
  );
}
