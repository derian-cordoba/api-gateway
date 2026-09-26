"use client";

import { useId } from "react";
import { FormField } from "@/modules/shared/components/form-controls/FormField";
import { SelectInput } from "@/modules/shared/components/form-controls/SelectInput";
import type { RouteSourceSummary } from "../services/route-sources";

type Driver = RouteSourceSummary["driver"];
const drivers: { value: Driver; label: string }[] = [
  { value: "local-json", label: "Legacy — JSON file" },
  { value: "sqlite", label: "Database — SQLite" },
  { value: "postgres", label: "Database — PostgreSQL" },
  { value: "mongodb", label: "Database — MongoDB" },
];

export function RouteStorageDriverSelector({
  sources,
  value,
  disabled,
  onChange,
}: {
  sources: RouteSourceSummary[];
  value: Driver | "";
  disabled: boolean;
  onChange: (driver: Driver) => void;
}) {
  const hintId = useId();
  return (
    <>
      <FormField label="Route storage driver">
        <SelectInput
          aria-describedby={hintId}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as Driver)}
        >
          {!value && (
            <option value="" disabled>
              Select a driver
            </option>
          )}
          {drivers.map(({ value: driver, label }) => {
            const available = sources.some((source) => source.driver === driver);
            return (
              <option key={driver} value={driver} disabled={!available}>
                {label}
                {!available && " (not configured)"}
              </option>
            );
          })}
        </SelectInput>
      </FormField>

      <p id={hintId} className="form-field__hint">
        Choose a configured driver. Unavailable drivers need a server connection configured on both
        the Dashboard and gateway.
      </p>
    </>
  );
}
