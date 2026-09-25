"use client";

import { Trash2 } from "lucide-react";
import { NumberInput, TextInput } from "@/modules/shared/components/FormControls";
import type { ProxyConfig } from "../proxy-editor.types";

type Target = NonNullable<ProxyConfig["targets"]>[number];

export function UpstreamTargetRow({
  target,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  target: Target;
  index: number;
  canRemove: boolean;
  onChange: (target: Target) => void;
  onRemove: () => void;
}) {
  return (
    <div className="collection-row collection-row--target">
      <TextInput
        aria-label={`Target ${index + 1} URL`}
        type="url"
        value={target.url}
        onChange={(event) => onChange({ ...target, url: event.target.value })}
      />
      <NumberInput
        aria-label={`Target ${index + 1} weight`}
        min={1}
        value={target.weight}
        onValue={(weight) => onChange({ ...target, weight })}
        placeholder="Weight"
      />
      <button
        type="button"
        className="icon-button"
        aria-label={`Remove target ${index + 1}`}
        disabled={!canRemove}
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
