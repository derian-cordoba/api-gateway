"use client";

import type * as React from "react";

export function NumberInput({
  value,
  onValue,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value?: number;
  onValue: (value: number | undefined) => void;
}) {
  return (
    <input
      {...props}
      className={`input ${props.className ?? ""}`}
      type="number"
      value={value ?? ""}
      onChange={(event) =>
        onValue(event.target.value === "" ? undefined : Number(event.target.value))
      }
    />
  );
}
