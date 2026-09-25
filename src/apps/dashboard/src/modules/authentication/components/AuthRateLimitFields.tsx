"use client";

import type { AuthRateLimit } from "@/modules/configuration/types/configuration.types";
import { FormField, NumberInput, Toggle } from "@/modules/shared/components/FormControls";

export function AuthRateLimitFields({
  value,
  onChange,
}: {
  value?: AuthRateLimit;
  onChange: (value?: AuthRateLimit) => void;
}) {
  return (
    <div className="nested-panel">
      <Toggle
        checked={value !== undefined}
        onChange={(enabled) => onChange(enabled ? { max: 5, windowMs: 60_000 } : undefined)}
        label="Limit failed authentication attempts"
      />
      {value && (
        <div className="form-grid form-grid--top-gap">
          <FormField label="Maximum failures">
            <NumberInput
              min={1}
              value={value.max}
              onValue={(max) => onChange({ ...value, max: max ?? 1 })}
            />
          </FormField>
          <FormField label="Window" hint="Milliseconds">
            <NumberInput
              min={1}
              value={value.windowMs}
              onValue={(windowMs) => onChange({ ...value, windowMs: windowMs ?? 1 })}
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
