"use client";

import type { HeaderTransform } from "@/modules/configuration/types/configuration.types";
import {
  FormField,
  KeyValueEditor,
  StringListInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";

export function TransformPanel({
  title,
  value,
  onChange,
}: {
  title: string;
  value?: HeaderTransform;
  onChange: (value?: HeaderTransform) => void;
}) {
  return (
    <div className="nested-panel nested-panel--flush">
      <Toggle
        checked={value !== undefined}
        onChange={(enabled) => onChange(enabled ? { set: {} } : undefined)}
        label={title}
      />
      {value && (
        <div className="stack form-grid--top-gap">
          <div>
            <h3>Set headers</h3>
            <KeyValueEditor
              value={value.set}
              onChange={(set) => onChange(omitUndefined({ ...value, set }))}
              keyPlaceholder="Header name"
            />
          </div>
          <FormField label="Remove headers">
            <StringListInput
              value={value.remove}
              onChange={(remove) => onChange(omitUndefined({ ...value, remove }))}
              placeholder="Server"
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
