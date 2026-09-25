"use client";

import { FormField, StringListInput, TextInput } from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";
import type { Auth } from "../authentication-editor.types";

export function ApiKeyFields({
  value,
  onChange,
}: {
  value: Extract<Auth, { strategy: "apiKey" }>;
  onChange: (value: Auth) => void;
}) {
  return (
    <div className="form-grid form-grid--top-gap">
      <FormField label="Header name">
        <TextInput
          value={value.header ?? ""}
          onChange={(event) =>
            onChange(omitUndefined({ ...value, header: event.target.value || undefined }))
          }
          placeholder="x-api-key"
        />
      </FormField>
      <FormField label="Accepted keys" hint="One key per line.">
        <StringListInput
          value={value.keys}
          onChange={(keys) => onChange({ ...value, keys: keys ?? [] })}
        />
      </FormField>
    </div>
  );
}
