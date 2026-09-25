"use client";

export function RawRouteEditor({
  value,
  error,
  onChange,
}: {
  value: string;
  error: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="raw-editor">
      <textarea
        className="input textarea code-input"
        rows={28}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        aria-label="Route JSON"
        aria-invalid={!!error}
      />
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
