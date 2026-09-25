"use client";

import { FormField, TextInput, Toggle } from "@/modules/shared/components/FormControls";
import type { ProxyConfig, UpdateProxy } from "../proxy-editor.types";

export function UpstreamSigningFields({
  value,
  update,
}: {
  value: ProxyConfig;
  update: UpdateProxy;
}) {
  return (
    <div className="nested-panel nested-panel--flush">
      <Toggle
        checked={value.upstreamAuth !== undefined}
        onChange={(enabled) =>
          update({ upstreamAuth: enabled ? { type: "hmac-sha256", secret: "" } : undefined })
        }
        label="Sign upstream requests"
      />
      {value.upstreamAuth && (
        <div className="form-grid form-grid--top-gap">
          <FormField label="HMAC secret" hint="Shared with the upstream service." wide>
            <TextInput
              type="password"
              autoComplete="new-password"
              value={value.upstreamAuth.secret}
              onChange={(event) =>
                update({ upstreamAuth: { ...value.upstreamAuth!, secret: event.target.value } })
              }
            />
          </FormField>
          <FormField label="Signature header" hint="Defaults to x-gateway-signature." wide>
            <TextInput
              value={value.upstreamAuth.header ?? ""}
              onChange={(event) =>
                update({
                  upstreamAuth: {
                    ...value.upstreamAuth!,
                    header: event.target.value || undefined,
                  },
                })
              }
              placeholder="x-gateway-signature"
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
