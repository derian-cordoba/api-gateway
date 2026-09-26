"use client";

import { HttpMethod } from "@shared/http/HttpMethod";

import {
  FormField,
  NumberInput,
  SelectInput,
  Toggle,
} from "@/modules/shared/components/FormControls";
import type { ProxyConfig, UpdateProxy } from "../proxy-editor.types";

export function ProxyTransportFields({
  value,
  update,
}: {
  value: ProxyConfig;
  update: UpdateProxy;
}) {
  return (
    <>
      <div className="form-grid form-grid--top-gap">
        <FormField label="HTTP method">
          <SelectInput
            value={value.method ?? ""}
            onChange={(event) =>
              update({ method: (event.target.value || undefined) as ProxyConfig["method"] })
            }
          >
            <option value="">Preserve incoming method</option>
            {Object.values(HttpMethod).map((method) => (
              <option key={method}>{method}</option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="Timeout" hint="Milliseconds before the upstream request is cancelled.">
          <NumberInput
            min={1}
            value={value.timeout}
            onValue={(timeout) => update({ timeout })}
            placeholder="30000"
          />
        </FormField>
      </div>
      <div className="toggle-grid">
        <Toggle
          checked={value.changeOrigin ?? false}
          onChange={(changeOrigin) => update({ changeOrigin })}
          label="Rewrite Host header"
        />
        <Toggle
          checked={value.isSecure ?? true}
          onChange={(isSecure) => update({ isSecure })}
          label="Verify upstream TLS"
        />
        <Toggle
          checked={value.ws ?? false}
          onChange={(ws) =>
            update({ ws, ...(ws ? {} : { maxConnections: undefined, idleTimeoutMs: undefined }) })
          }
          label="Proxy WebSockets"
        />
      </div>
      {value.ws && (
        <div className="form-grid">
          <FormField label="Maximum WebSocket connections" hint="Optional per-route cap.">
            <NumberInput
              min={1}
              value={value.maxConnections}
              onValue={(maxConnections) => update({ maxConnections })}
            />
          </FormField>
          <FormField label="WebSocket idle timeout" hint="Optional milliseconds.">
            <NumberInput
              min={1}
              value={value.idleTimeoutMs}
              onValue={(idleTimeoutMs) => update({ idleTimeoutMs })}
            />
          </FormField>
        </div>
      )}
    </>
  );
}
