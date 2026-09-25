"use client";

import { StatusCodes as HttpStatus } from "http-status-codes";
import { MAX_HTTP_STATUS_CODE, MIN_HTTP_STATUS_CODE } from "@shared/http/httpStatusRange";
import {
  FieldGroup,
  FormField,
  KeyValueEditor,
  NumberInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import { JsonValueInput } from "@/modules/shared/components/JsonValueInput";
import type { CircuitBreakerConfig, UpdateCircuitBreaker } from "../circuit-breaker-editor.types";

export function CircuitFallbackFields({
  config,
  update,
}: {
  config: CircuitBreakerConfig;
  update: UpdateCircuitBreaker;
}) {
  return (
    <div className="nested-panel">
      <Toggle
        checked={config.fallback !== undefined}
        onChange={(enabled) =>
          update({
            fallback: enabled
              ? { status: HttpStatus.SERVICE_UNAVAILABLE, body: { degraded: true } }
              : undefined,
          })
        }
        label="Serve a fallback response while open"
      />
      {config.fallback && (
        <div className="form-grid form-grid--top-gap">
          <FormField label="Fallback status">
            <NumberInput
              min={MIN_HTTP_STATUS_CODE}
              max={MAX_HTTP_STATUS_CODE}
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
          <FieldGroup label="Fallback headers" wide>
            <KeyValueEditor
              value={config.fallback.headers}
              onChange={(headers) => update({ fallback: { ...config.fallback!, headers } })}
              keyPlaceholder="Header name"
              valuePlaceholder="Header value"
            />
          </FieldGroup>
        </div>
      )}
    </div>
  );
}
