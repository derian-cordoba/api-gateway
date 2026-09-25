"use client";

import { Trash2 } from "lucide-react";
import { TextInput } from "./TextInput";

export function NewKeyValueRow({
  draft,
  index,
  keyPlaceholder,
  valuePlaceholder,
  onChange,
  onCommit,
  onRemove,
}: {
  draft: [string, string];
  index: number;
  keyPlaceholder: string;
  valuePlaceholder: string;
  onChange: (draft: [string, string]) => void;
  onCommit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="collection-row"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onCommit();
      }}
    >
      <TextInput
        aria-label={`${keyPlaceholder} ${index + 1}`}
        value={draft[0]}
        placeholder={keyPlaceholder}
        onChange={(event) => onChange([event.target.value, draft[1]])}
      />
      <TextInput
        aria-label={`${valuePlaceholder} ${index + 1}`}
        value={draft[1]}
        placeholder={valuePlaceholder}
        onChange={(event) => onChange([draft[0], event.target.value])}
      />
      <button className="icon-button" type="button" aria-label="Remove new row" onClick={onRemove}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
