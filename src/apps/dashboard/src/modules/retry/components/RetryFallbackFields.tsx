"use client";

import { StatusCodes as HttpStatus } from "http-status-codes";
import { MAX_HTTP_STATUS_CODE, MIN_HTTP_STATUS_CODE } from "@shared/http/httpStatusRange";
import { FormField, NumberInput, Toggle } from "@/modules/shared/components/FormControls";
import { JsonValueInput } from "@/modules/shared/components/JsonValueInput";
import type { RetryConfig, UpdateRetry } from "../retry-editor.types";

export function RetryFallbackFields({
  config,
  update,
}: {
  config: RetryConfig;
  update: UpdateRetry;
}) {
  return (
    <div className="nested-panel">
      <Toggle
        checked={config.fallback !== undefined}
        onChange={(enabled) =>
          update({
            fallback: enabled
              ? { status: HttpStatus.BAD_GATEWAY, body: { error: "Upstream unavailable" } }
              : undefined,
          })
        }
        label="Serve a fallback after retries are exhausted"
      />
      {config.fallback && (
        <div className="form-grid form-grid--top-gap">
          <FormField label="Fallback status">
            <NumberInput
              min={MIN_HTTP_STATUS_CODE}
              max={MAX_HTTP_STATUS_CODE}
              value={config.fallback.status}
              onValue={(status) => update({ fallback: { ...config.fallback!, status } })}
              placeholder="502"
            />
          </FormField>
          <FormField label="Fallback body" hint="Any valid JSON value." wide>
            <JsonValueInput
              value={config.fallback.body}
              onChange={(body) => update({ fallback: { ...config.fallback!, body } })}
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
