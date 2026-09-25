"use client";

import { FormField, NumberInput, TextInput } from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";
import type { Auth } from "../authentication-editor.types";

export function OAuthFields({
  value,
  onChange,
}: {
  value: Extract<Auth, { strategy: "oauth2" }>;
  onChange: (value: Auth) => void;
}) {
  const update = (patch: Partial<typeof value>) => onChange(omitUndefined({ ...value, ...patch }));
  return (
    <div className="form-grid form-grid--top-gap">
      <FormField label="Introspection URL" wide>
        <TextInput
          type="url"
          value={value.introspectionUrl}
          onChange={(event) => update({ introspectionUrl: event.target.value })}
        />
      </FormField>
      <FormField label="Client ID">
        <TextInput
          value={value.clientId}
          onChange={(event) => update({ clientId: event.target.value })}
        />
      </FormField>
      <FormField label="Client secret">
        <TextInput
          type="password"
          autoComplete="new-password"
          value={value.clientSecret}
          onChange={(event) => update({ clientSecret: event.target.value })}
        />
      </FormField>
      <FormField label="Token type hint">
        <TextInput
          value={value.tokenTypeHint ?? ""}
          onChange={(event) => update({ tokenTypeHint: event.target.value || undefined })}
          placeholder="access_token"
        />
      </FormField>
      <FormField label="Introspection cache TTL" hint="Milliseconds">
        <NumberInput
          min={1}
          value={value.introspectionCacheTtlMs}
          onValue={(introspectionCacheTtlMs) => update({ introspectionCacheTtlMs })}
        />
      </FormField>
    </div>
  );
}
