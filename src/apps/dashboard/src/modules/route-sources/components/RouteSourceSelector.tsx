import { FormField } from "@/modules/shared/components/form-controls/FormField";
import { SelectInput } from "@/modules/shared/components/form-controls/SelectInput";
import type { RouteSourceSummary } from "../services/route-sources";

export function RouteSourceSelector({
  sources,
  value,
  disabled,
  onChange,
}: {
  sources: RouteSourceSummary[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <FormField label="Source to edit">
      <SelectInput
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.name}
            {source.environment ? ` · ${source.environment}` : ""}
          </option>
        ))}
      </SelectInput>
    </FormField>
  );
}
