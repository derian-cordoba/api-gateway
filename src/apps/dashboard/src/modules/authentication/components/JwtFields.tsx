"use client";

import {
  FieldGroup,
  FormField,
  KeyValueEditor,
  StringListInput,
  TextInput,
} from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";
import type { Auth } from "../authentication-editor.types";

export function JwtFields({
  value,
  onChange,
}: {
  value: Extract<Auth, { strategy: "jwt" }>;
  onChange: (value: Auth) => void;
}) {
  const update = (patch: Partial<typeof value>) => onChange(omitUndefined({ ...value, ...patch }));
  return (
    <div className="form-grid form-grid--top-gap">
      <FormField label="HMAC secret" hint="Use one credential source. JWKS takes precedence.">
        <TextInput
          type="password"
          value={value.secret ?? ""}
          onChange={(event) => update({ secret: event.target.value || undefined })}
          autoComplete="new-password"
        />
      </FormField>
      <FormField label="JWKS URL">
        <TextInput
          type="url"
          value={value.jwksUri ?? ""}
          onChange={(event) => update({ jwksUri: event.target.value || undefined })}
          placeholder="https://issuer/.well-known/jwks.json"
        />
      </FormField>
      <FormField label="Public key" wide>
        <textarea
          className="input textarea code-input"
          rows={4}
          value={value.publicKey ?? ""}
          onChange={(event) => update({ publicKey: event.target.value || undefined })}
          placeholder="-----BEGIN PUBLIC KEY-----"
        />
      </FormField>
      <FormField label="Allowed algorithms" hint="One per line or comma separated.">
        <StringListInput
          value={value.algorithms}
          onChange={(algorithms) => update({ algorithms })}
          placeholder="RS256"
        />
      </FormField>
      <FieldGroup
        label="Forward claims"
        hint="Map JWT claim names to upstream request header names."
        wide
      >
        <KeyValueEditor
          value={value.forwardClaims}
          onChange={(forwardClaims) => update({ forwardClaims })}
          keyPlaceholder="Claim, e.g. sub"
          valuePlaceholder="Header, e.g. X-User-Id"
        />
      </FieldGroup>
    </div>
  );
}
