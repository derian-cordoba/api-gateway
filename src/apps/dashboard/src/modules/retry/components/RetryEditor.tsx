"use client";

import { StatusCodes as HttpStatus } from "http-status-codes";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { MAX_HTTP_STATUS_CODE, MIN_HTTP_STATUS_CODE } from "@shared/http/httpStatusRange";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import {
  FormField,
  NumberInput,
  NumberListInput,
  SelectInput,
  StringListInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import { JsonValueInput } from "@/modules/shared/components/JsonValueInput";
import { omitUndefined } from "@shared/objects/omitUndefined";

type Config = NonNullable<GatewayRoute["retry"]>;

export function RetryEditor({
  value,
  onChange,
}: {
  value?: Config;
  onChange: (value?: Config) => void;
}) {
  const config = value ?? { attempts: 3, delay: 250, backoff: "exponential-jitter" as const };
  const update = (patch: Partial<Config>) => onChange(omitUndefined({ ...config, ...patch }));
  return (
    <FeatureSection
      id="retry"
      title="Retries"
      description="Retry eligible requests when an upstream call fails."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="form-grid">
        <FormField label="Retry attempts" hint="Between 1 and 10">
          <NumberInput
            min={1}
            max={10}
            value={config.attempts}
            onValue={(attempts) => update({ attempts: attempts ?? 1 })}
          />
        </FormField>
        <FormField label="Base delay" hint="Milliseconds">
          <NumberInput
            min={0}
            value={config.delay}
            onValue={(delay) => update({ delay: delay ?? 0 })}
          />
        </FormField>
        <FormField label="Backoff">
          <SelectInput
            value={config.backoff ?? "fixed"}
            onChange={(event) => update({ backoff: event.target.value as Config["backoff"] })}
          >
            <option value="fixed">Fixed</option>
            <option value="exponential">Exponential</option>
            <option value="exponential-jitter">Exponential with jitter</option>
          </SelectInput>
        </FormField>
        <FormField label="Retry status codes" hint="Comma separated. Defaults to all 5xx.">
          <NumberListInput
            value={config.retryOn}
            onChange={(retryOn) => update({ retryOn })}
            placeholder="500, 502, 503, 504"
          />
        </FormField>
        <FormField label="Eligible methods" hint="One per line or comma separated." wide>
          <StringListInput
            value={config.retryMethods}
            onChange={(retryMethods) => update({ retryMethods })}
            placeholder="GET, HEAD, OPTIONS"
          />
        </FormField>
      </div>
      <div className="toggle-grid">
        <Toggle
          checked={config.collapseRequests ?? false}
          onChange={(collapseRequests) => update({ collapseRequests })}
          label="Collapse identical in-flight requests"
        />
      </div>
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
        {config.fallback ? (
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
        ) : null}
      </div>
    </FeatureSection>
  );
}
