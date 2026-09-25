"use client";

import { Plus } from "lucide-react";
import { FormField, SelectInput, TextInput } from "@/modules/shared/components/FormControls";
import type { ProxyConfig, UpdateProxy } from "../proxy-editor.types";
import { UpstreamTargetRow } from "./UpstreamTargetRow";

export function UpstreamTargetFields({
  value,
  loadBalanced,
  update,
}: {
  value: ProxyConfig;
  loadBalanced: boolean;
  update: UpdateProxy;
}) {
  return (
    <>
      {!loadBalanced ? (
        <div className="form-grid">
          <FormField label="Target URL" hint="The upstream service base URL." wide>
            <TextInput
              type="url"
              value={value.target ?? ""}
              onChange={(event) => update({ target: event.target.value })}
              placeholder="https://service.internal"
            />
          </FormField>
        </div>
      ) : (
        <div className="stack">
          <FormField label="Balancing strategy">
            <SelectInput
              value={value.strategy ?? "round-robin"}
              onChange={(event) =>
                update({
                  strategy: event.target.value as ProxyConfig["strategy"],
                  stickyKey:
                    event.target.value === "sticky" ? (value.stickyKey ?? "ip") : undefined,
                })
              }
            >
              <option value="round-robin">Round robin</option>
              <option value="weighted">Weighted</option>
              <option value="least-connections">Least connections</option>
              <option value="sticky">Sticky session</option>
            </SelectInput>
          </FormField>
          {value.strategy === "sticky" && (
            <FormField label="Sticky key" hint='Use ip or a source such as "cookie:session_id".'>
              <TextInput
                value={value.stickyKey ?? "ip"}
                onChange={(event) => update({ stickyKey: event.target.value })}
              />
            </FormField>
          )}
          <div className="collection-editor">
            {(value.targets ?? []).map((target, index) => (
              <UpstreamTargetRow
                key={index}
                target={target}
                index={index}
                canRemove={(value.targets?.length ?? 0) > 2}
                onChange={(nextTarget) => {
                  const targets = [...(value.targets ?? [])];
                  targets[index] = nextTarget;
                  update({ targets });
                }}
                onRemove={() =>
                  update({
                    targets: value.targets?.filter((_, targetIndex) => targetIndex !== index),
                  })
                }
              />
            ))}
            <button
              type="button"
              className="button button--quiet button--small"
              onClick={() =>
                update({ targets: [...(value.targets ?? []), { url: "http://localhost:4000" }] })
              }
            >
              <Plus size={15} /> Add target
            </button>
          </div>
        </div>
      )}
    </>
  );
}
