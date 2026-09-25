"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { KeyValueRow } from "./KeyValueRow";
import { NewKeyValueRow } from "./NewKeyValueRow";

export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "Header or pattern",
  valuePlaceholder = "Value",
}: {
  value?: Record<string, string>;
  onChange: (value: Record<string, string> | undefined) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const rows = Object.entries(value ?? {});
  const [draft, setDraft] = useState<[string, string] | null>(null);

  const updateRows = (nextRows: Array<[string, string]>) => {
    const next = Object.fromEntries(nextRows.filter(([key]) => key.trim() !== ""));
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  const commitDraft = () => {
    if (!draft?.[0].trim()) return;
    updateRows([...rows, draft]);
    setDraft(null);
  };

  return (
    <div className="collection-editor">
      {rows.map((entry, index) => (
        <KeyValueRow
          key={index}
          entry={entry}
          index={index}
          keyPlaceholder={keyPlaceholder}
          valuePlaceholder={valuePlaceholder}
          onChange={(nextEntry) => {
            const next = [...rows] as Array<[string, string]>;
            next[index] = nextEntry;
            updateRows(next);
          }}
          onRemove={() => updateRows(rows.filter((_, rowIndex) => rowIndex !== index))}
        />
      ))}
      {draft && (
        <NewKeyValueRow
          draft={draft}
          index={rows.length}
          keyPlaceholder={keyPlaceholder}
          valuePlaceholder={valuePlaceholder}
          onChange={setDraft}
          onCommit={commitDraft}
          onRemove={() => setDraft(null)}
        />
      )}
      <button
        className="button button--quiet button--small"
        type="button"
        onClick={() => {
          if (draft) commitDraft();
          else setDraft(["", ""]);
        }}
      >
        <Plus size={15} /> Add entry
      </button>
    </div>
  );
}
