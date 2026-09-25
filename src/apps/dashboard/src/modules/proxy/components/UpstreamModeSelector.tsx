"use client";

import { omitUndefined } from "@shared/objects/omitUndefined";
import type { ProxyConfig } from "./proxy-editor.types";

export function UpstreamModeSelector({
  value,
  onChange,
}: {
  value: ProxyConfig;
  onChange: (value: ProxyConfig) => void;
}) {
  const loadBalanced = value.targets !== undefined;
  return (
    <div className="segmented-control" role="group" aria-label="Upstream mode">
      <button
        type="button"
        className={!loadBalanced ? "active" : ""}
        aria-pressed={!loadBalanced}
        onClick={() =>
          onChange(
            omitUndefined({
              ...value,
              targets: undefined,
              strategy: undefined,
              stickyKey: undefined,
              target: value.target ?? "http://localhost:4000",
            }),
          )
        }
      >
        Single target
      </button>
      <button
        type="button"
        className={loadBalanced ? "active" : ""}
        aria-pressed={loadBalanced}
        onClick={() =>
          onChange(
            omitUndefined({
              ...value,
              target: undefined,
              targets: value.targets ?? [
                { url: "http://localhost:4001" },
                { url: "http://localhost:4002" },
              ],
              strategy: value.strategy ?? "round-robin",
            }),
          )
        }
      >
        Load balanced
      </button>
    </div>
  );
}
