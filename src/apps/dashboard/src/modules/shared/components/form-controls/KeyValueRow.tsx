"use client";

import { Trash2 } from "lucide-react";
import { TextInput } from "./TextInput";

export function KeyValueRow({
  entry,
  index,
  keyPlaceholder,
  valuePlaceholder,
  onChange,
  onRemove,
}: {
  entry: [string, string];
  index: number;
  keyPlaceholder: string;
  valuePlaceholder: string;
  onChange: (entry: [string, string]) => void;
  onRemove: () => void;
}) {
  const [key, value] = entry;
  return (
    <div className="collection-row">
      <TextInput
        aria-label={`${keyPlaceholder} ${index + 1}`}
        value={key}
        placeholder={keyPlaceholder}
        onChange={(event) => onChange([event.target.value, value])}
      />
      <TextInput
        aria-label={`${valuePlaceholder} ${index + 1}`}
        value={value}
        placeholder={valuePlaceholder}
        onChange={(event) => onChange([key, event.target.value])}
      />
      <button
        className="icon-button"
        type="button"
        aria-label={`Remove ${key || "row"}`}
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
