"use client";

import { useId, type ReactNode } from "react";

export function FieldGroup({
  label,
  hint,
  children,
  wide = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <div
      className={wide ? "form-field form-field--wide" : "form-field"}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
    >
      <span className="form-field__label" id={labelId}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="form-field__hint" id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}
