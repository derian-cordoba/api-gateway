"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => setText(formatJson(value)), [value]);

  return <div>
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
        try {
          onChange(JSON.parse(next) as unknown);
          setError("");
        } catch {
          setError("Enter valid JSON before saving.");
        }
      }}
    />
    {error ? <span className="field-error">{error}</span> : null}
  </div>;
}

function formatJson(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}
