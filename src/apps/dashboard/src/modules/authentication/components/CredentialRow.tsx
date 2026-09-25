"use client";

import { Trash2 } from "lucide-react";
import { TextInput } from "@/modules/shared/components/FormControls";
import type { Auth } from "../authentication-editor.types";

type Credential = Extract<Auth, { strategy: "basicAuth" }>["credentials"][number];

export function CredentialRow({
  credential,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  credential: Credential;
  index: number;
  canRemove: boolean;
  onChange: (credential: Credential) => void;
  onRemove: () => void;
}) {
  return (
    <div className="collection-row">
      <TextInput
        aria-label={`Username ${index + 1}`}
        value={credential.username}
        placeholder="Username"
        onChange={(event) => onChange({ ...credential, username: event.target.value })}
      />
      <TextInput
        aria-label={`Password ${index + 1}`}
        type="password"
        autoComplete="new-password"
        value={credential.password}
        placeholder="Password"
        onChange={(event) => onChange({ ...credential, password: event.target.value })}
      />
      <button
        className="icon-button"
        type="button"
        aria-label={`Remove credential ${index + 1}`}
        disabled={!canRemove}
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
