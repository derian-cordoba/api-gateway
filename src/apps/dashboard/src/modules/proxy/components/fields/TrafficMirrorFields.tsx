"use client";

import {
  FormField,
  NumberInput,
  TextInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import type { ProxyConfig, UpdateProxy } from "../proxy-editor.types";

export function TrafficMirrorFields({
  value,
  retryEnabled,
  update,
}: {
  value: ProxyConfig;
  retryEnabled: boolean;
  update: UpdateProxy;
}) {
  return (
    <div className="nested-panel nested-panel--flush">
      <Toggle
        checked={value.mirror !== undefined}
        onChange={(enabled) =>
          update({
            mirror: enabled ? { target: "http://localhost:4400", percentage: 100 } : undefined,
          })
        }
        label="Mirror traffic"
      />
      {value.mirror && (
        <div className="form-grid form-grid--top-gap">
          <FormField
            label="Mirror target"
            hint="Fire-and-forget target. Requires retries on this route."
            wide
          >
            <TextInput
              type="url"
              value={value.mirror.target}
              onChange={(event) =>
                update({ mirror: { ...value.mirror!, target: event.target.value } })
              }
            />
          </FormField>
          <FormField label="Traffic percentage" hint="0 to 100." wide>
            <NumberInput
              min={0}
              max={100}
              value={value.mirror.percentage}
              onValue={(percentage) => update({ mirror: { ...value.mirror!, percentage } })}
              placeholder="100"
            />
          </FormField>
        </div>
      )}
      {value.mirror && !retryEnabled && (
        <div className="inline-warning">
          Enable retries for this route to activate traffic mirroring.
        </div>
      )}
    </div>
  );
}
