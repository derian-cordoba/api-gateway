"use client";

import {
  FormField,
  NumberInput,
  TextInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import type { CircuitBreakerConfig, UpdateCircuitBreaker } from "../circuit-breaker-editor.types";

export function HealthCheckFields({
  config,
  update,
}: {
  config: CircuitBreakerConfig;
  update: UpdateCircuitBreaker;
}) {
  return (
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
      {config.healthCheck && (
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
      )}
    </div>
  );
}
