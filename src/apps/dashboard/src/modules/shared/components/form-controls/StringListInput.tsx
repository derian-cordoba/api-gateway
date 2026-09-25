"use client";

import { useState } from "react";

export function StringListInput({
  value,
  onChange,
  placeholder,
}: {
  value?: string[];
  onChange: (value: string[] | undefined) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => (value ?? []).join("\n"));
  return (
    <textarea
      className="input textarea"
      rows={3}
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const items = next
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean);
        onChange(items.length > 0 ? items : undefined);
      }}
    />
  );
}
