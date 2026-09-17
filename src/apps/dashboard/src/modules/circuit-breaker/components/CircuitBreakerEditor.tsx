"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import {
  FormField,
  KeyValueEditor,
  NumberInput,
  TextInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import { JsonValueInput } from "@/modules/shared/components/JsonValueInput";

type Config = NonNullable<GatewayRoute["circuitBreaker"]>;

export function CircuitBreakerEditor({
  value,
  onChange,
}: {
  value?: Config;
  onChange: (value?: Config) => void;
}) {
  const config = value ?? { threshold: 5, timeout: 30_000 };
  const update = (patch: Partial<Config>) => onChange({ ...config, ...patch });
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
      <div className="nested-panel">
        <Toggle
          checked={config.healthCheck !== undefined}
          onChange={(enabled) =>
            update({
              healthCheck: enabled
                ? { url: "http://localhost:4000/health", intervalMs: 10_000 }
                : undefined,
            })
          }
          label="Use active health checks"
        />
        {config.healthCheck ? (
          <div className="form-grid form-grid--top-gap">
            <FormField label="Health URL" wide>
              <TextInput
                type="url"
                value={config.healthCheck.url}
                onChange={(event) =>
                  update({ healthCheck: { ...config.healthCheck!, url: event.target.value } })
                }
              />
            </FormField>
            <FormField label="Probe interval" hint="Milliseconds">
              <NumberInput
                min={1}
                value={config.healthCheck.intervalMs}
                onValue={(intervalMs) =>
                  update({ healthCheck: { ...config.healthCheck!, intervalMs: intervalMs ?? 1 } })
                }
              />
            </FormField>
            <FormField label="Probe timeout" hint="Milliseconds">
              <NumberInput
                min={1}
                value={config.healthCheck.timeoutMs}
                onValue={(timeoutMs) =>
                  update({ healthCheck: { ...config.healthCheck!, timeoutMs } })
                }
              />
            </FormField>
          </div>
        ) : null}
      </div>
      <div className="nested-panel">
        <Toggle
          checked={config.fallback !== undefined}
          onChange={(enabled) =>
            update({ fallback: enabled ? { status: 503, body: { degraded: true } } : undefined })
          }
          label="Serve a fallback response while open"
        />
        {config.fallback ? (
          <div className="form-grid form-grid--top-gap">
            <FormField label="Fallback status">
              <NumberInput
                min={100}
                max={599}
                value={config.fallback.status}
                onValue={(status) => update({ fallback: { ...config.fallback!, status } })}
                placeholder="503"
              />
            </FormField>
            <FormField label="Fallback body" hint="Any valid JSON value." wide>
              <JsonValueInput
                value={config.fallback.body}
                onChange={(body) => update({ fallback: { ...config.fallback!, body } })}
              />
            </FormField>
            <FormField label="Fallback headers" wide>
              <KeyValueEditor
                value={config.fallback.headers}
                onChange={(headers) => update({ fallback: { ...config.fallback!, headers } })}
                keyPlaceholder="Header name"
                valuePlaceholder="Header value"
              />
            </FormField>
          </div>
        ) : null}
      </div>
    </FeatureSection>
  );
}
