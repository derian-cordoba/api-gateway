"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export function FormField({
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
  return (
    <label className={wide ? "form-field form-field--wide" : "form-field"}>
      <span className="form-field__label">{label}</span>
      {children}
      {hint ? <span className="form-field__hint">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ""}`} />;
}

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

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input select ${props.className ?? ""}`} />;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="toggle-row">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={checked ? "switch switch--on" : "switch"}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
      <span>{label}</span>
    </label>
  );
}

export function StringListInput({
  value,
  onChange,
  placeholder,
}: {
  value?: string[];
  onChange: (value: string[] | undefined) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      className="input textarea"
      rows={3}
      value={(value ?? []).join("\n")}
      placeholder={placeholder}
      onChange={(event) => {
        const items = event.target.value
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean);
        onChange(items.length > 0 ? items : undefined);
      }}
    />
  );
}

export function NumberListInput({
  value,
  onChange,
  placeholder,
}: {
  value?: number[];
  onChange: (value: number[] | undefined) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={(value ?? []).join(", ")}
      placeholder={placeholder}
      onChange={(event) => {
        const items = event.target.value
          .split(",")
          .map((item) => Number(item.trim()))
          .filter((item) => Number.isFinite(item));
        onChange(items.length > 0 ? items : undefined);
      }}
    />
  );
}

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

  const updateRows = (nextRows: Array<[string, string]>) => {
    const next = Object.fromEntries(nextRows.filter(([key]) => key.trim() !== ""));
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <div className="collection-editor">
      {rows.map(([key, entryValue], index) => (
        <div className="collection-row" key={`${key}-${index}`}>
          <TextInput
            aria-label={`${keyPlaceholder} ${index + 1}`}
            value={key}
            placeholder={keyPlaceholder}
            onChange={(event) => {
              const next = [...rows] as Array<[string, string]>;
              next[index] = [event.target.value, entryValue];
              updateRows(next);
            }}
          />
          <TextInput
            aria-label={`${valuePlaceholder} ${index + 1}`}
            value={entryValue}
            placeholder={valuePlaceholder}
            onChange={(event) => {
              const next = [...rows] as Array<[string, string]>;
              next[index] = [key, event.target.value];
              updateRows(next);
            }}
          />
          <button
            className="icon-button"
            type="button"
            aria-label={`Remove ${key || "row"}`}
            onClick={() => updateRows(rows.filter((_, rowIndex) => rowIndex !== index))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        className="button button--quiet button--small"
        type="button"
        onClick={() => updateRows([...rows, ["", ""]])}
      >
        <Plus size={15} /> Add entry
      </button>
    </div>
  );
}
