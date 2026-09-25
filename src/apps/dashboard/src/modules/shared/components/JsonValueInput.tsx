"use client";

import { useState } from "react";
import { tryParseJson } from "@shared/json/tryParseJson";

export function JsonValueInput({
  value,
  onChange,
  placeholder = '{\n  "degraded": true\n}',
  rows = 5,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [text, setText] = useState(() => formatJson(value));
  const [error, setError] = useState("");

  return (
    <div>
      <textarea
        className="input textarea code-input"
        rows={rows}
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (next.trim() === "") {
            setError("");
            onChange(undefined);
            return;
          }
          const parsed = tryParseJson(next);
          if (parsed.success) {
            onChange(parsed.value);
            setError("");
          } else {
            setError("Enter valid JSON before saving.");
          }
        }}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function formatJson(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}
