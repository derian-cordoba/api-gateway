"use client";

import {
  FormField,
  SelectInput,
  StringListInput,
  TextInput,
} from "@/modules/shared/components/FormControls";
import type { CorsConfig, UpdateCors } from "../cors-editor.types";

type OriginMode = "single" | "multiple" | "reflect" | "disabled";

export function CorsOriginFields({ config, update }: { config: CorsConfig; update: UpdateCors }) {
  const mode: OriginMode = Array.isArray(config.origin)
    ? "multiple"
    : config.origin === true
      ? "reflect"
      : config.origin === false
        ? "disabled"
        : "single";

  const changeMode = (next: OriginMode) =>
    update({
      origin:
        next === "multiple"
          ? ["https://app.example.com"]
          : next === "reflect"
            ? true
            : next === "disabled"
              ? false
              : "*",
    });

  return (
    <>
      <FormField label="Origin mode">
        <SelectInput
          value={mode}
          onChange={(event) => changeMode(event.target.value as OriginMode)}
        >
          <option value="single">Single origin</option>
          <option value="multiple">Origin allowlist</option>
          <option value="reflect">Reflect request origin</option>
          <option value="disabled">Disable CORS</option>
        </SelectInput>
      </FormField>
      {mode === "single" && (
        <FormField label="Allowed origin">
          <TextInput
            value={typeof config.origin === "string" ? config.origin : "*"}
            onChange={(event) => update({ origin: event.target.value })}
          />
        </FormField>
      )}
      {mode === "multiple" && (
        <FormField label="Allowed origins">
          <StringListInput
            value={Array.isArray(config.origin) ? config.origin : []}
            onChange={(origin) => update({ origin: origin ?? [] })}
          />
        </FormField>
      )}
    </>
  );
}
