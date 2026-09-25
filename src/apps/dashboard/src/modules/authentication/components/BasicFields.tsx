"use client";

import { Plus } from "lucide-react";
import { FormField, TextInput } from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";
import type { Auth } from "../authentication-editor.types";
import { CredentialRow } from "./CredentialRow";

export function BasicFields({
  value,
  onChange,
}: {
  value: Extract<Auth, { strategy: "basicAuth" }>;
  onChange: (value: Auth) => void;
}) {
  return (
    <div className="stack form-grid--top-gap">
      <FormField label="Realm">
        <TextInput
          value={value.realm ?? ""}
          onChange={(event) =>
            onChange(omitUndefined({ ...value, realm: event.target.value || undefined }))
          }
        />
      </FormField>
      <div className="collection-editor">
        {value.credentials.map((credential, index) => (
          <CredentialRow
            key={index}
            credential={credential}
            index={index}
            canRemove={value.credentials.length > 1}
            onChange={(nextCredential) => {
              const credentials = [...value.credentials];
              credentials[index] = nextCredential;
              onChange({ ...value, credentials });
            }}
            onRemove={() =>
              onChange({
                ...value,
                credentials: value.credentials.filter((_, itemIndex) => itemIndex !== index),
              })
            }
          />
        ))}
        <button
          className="button button--quiet button--small"
          type="button"
          onClick={() =>
            onChange({
              ...value,
              credentials: [...value.credentials, { username: "", password: "" }],
            })
          }
        >
          <Plus size={15} /> Add credential
        </button>
      </div>
    </div>
  );
}
