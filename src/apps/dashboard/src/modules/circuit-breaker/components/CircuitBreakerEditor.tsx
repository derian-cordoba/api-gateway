"use client";

import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { FormField, NumberInput } from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";
import type { CircuitBreakerConfig } from "../circuit-breaker-editor.types";
import { HealthCheckFields } from "./HealthCheckFields";
import { CircuitFallbackFields } from "./CircuitFallbackFields";

export function CircuitBreakerEditor({
  value,
  onChange,
}: {
  value?: CircuitBreakerConfig;
  onChange: (value?: CircuitBreakerConfig) => void;
}) {
  const config = value ?? { threshold: 5, timeout: 30_000 };
  const update = (patch: Partial<CircuitBreakerConfig>) =>
    onChange(omitUndefined({ ...config, ...patch }));
  return (
    <FeatureSection
      id="circuitBreaker"
      title="Circuit breaker"
      description="Stop sending traffic to an unhealthy upstream."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="form-grid">
        <FormField label="Failure threshold">
          <NumberInput
            min={1}
            value={config.threshold}
            onValue={(threshold) => update({ threshold: threshold ?? 1 })}
          />
        </FormField>
        <FormField label="Open duration" hint="Milliseconds">
          <NumberInput
            min={1}
            value={config.timeout}
            onValue={(timeout) => update({ timeout: timeout ?? 1 })}
          />
        </FormField>
        <FormField label="Recovery successes">
          <NumberInput
            min={1}
            value={config.successThreshold}
            onValue={(successThreshold) => update({ successThreshold })}
            placeholder="1"
          />
        </FormField>
      </div>
      <HealthCheckFields config={config} update={update} />
      <CircuitFallbackFields config={config} update={update} />
    </FeatureSection>
  );
}
