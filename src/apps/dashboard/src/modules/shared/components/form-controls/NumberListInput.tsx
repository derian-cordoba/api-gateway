"use client";

import { useState } from "react";
import { TextInput } from "./TextInput";

export function NumberListInput({
  value,
  onChange,
  placeholder,
}: {
  value?: number[];
  onChange: (value: number[] | undefined) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => (value ?? []).join(", "));
  return (
    <TextInput
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const items = next
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map(Number)
          .filter((item) => Number.isFinite(item));
        onChange(items.length > 0 ? items : undefined);
      }}
    />
  );
}
