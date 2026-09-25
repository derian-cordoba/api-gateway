"use client";

import { Code2 } from "lucide-react";
import { FormField, TextInput } from "@/modules/shared/components/FormControls";

export function RouteBasics({
  baseURL,
  rawMode,
  onBaseURLChange,
  onToggleRaw,
}: {
  baseURL: string;
  rawMode: boolean;
  onBaseURLChange: (value: string) => void;
  onToggleRaw: () => void;
}) {
  return (
    <section className="route-basics">
      <div>
        <span className="eyebrow">Request matching</span>
        <h2>Route identity</h2>
        <p>The prefix clients use to reach this upstream.</p>
      </div>
      <FormField label="Base URL">
        <TextInput
          value={baseURL}
          onChange={(event) => onBaseURLChange(event.target.value)}
          placeholder="/products"
        />
      </FormField>
      <button type="button" className="button button--quiet button--small" onClick={onToggleRaw}>
        <Code2 size={16} /> {rawMode ? "Apply JSON" : "Edit JSON"}
      </button>
    </section>
  );
}
