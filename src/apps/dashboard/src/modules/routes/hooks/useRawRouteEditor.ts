"use client";

import { useState } from "react";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { GatewaySchema } from "@gateway/routes/validators/gateway.schema";
import { tryParseJson } from "@shared/json/tryParseJson";

export function useRawRouteEditor(value: GatewayRoute, onChange: (value: GatewayRoute) => void) {
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2));
  const [rawError, setRawError] = useState("");

  const toggleRaw = () => {
    if (!rawMode) {
      setRaw(JSON.stringify(value, null, 2));
      setRawError("");
      setRawMode(true);
      return;
    }

    const parsed = tryParseJson(raw);
    if (!parsed.success) {
      setRawError("Enter valid JSON before applying the route.");
      return;
    }
    const validated = GatewaySchema.safeParse(parsed.value);
    if (!validated.success) {
      setRawError(validated.error.issues[0]?.message ?? "Enter a valid route configuration.");
      return;
    }
    onChange(validated.data);
    setRawError("");
    setRawMode(false);
  };

  return { rawMode, raw, rawError, setRaw, toggleRaw };
}
