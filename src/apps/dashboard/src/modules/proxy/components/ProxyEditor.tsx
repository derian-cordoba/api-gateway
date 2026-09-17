"use client";

import { Plus, Trash2 } from "lucide-react";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import {
  FormField,
  KeyValueEditor,
  NumberInput,
  SelectInput,
  TextInput,
  Toggle,
} from "@/modules/shared/components/FormControls";

type ProxyConfig = GatewayRoute["proxy"];

export function ProxyEditor({
  value,
  retryEnabled,
  onChange,
}: {
  value: ProxyConfig;
  retryEnabled: boolean;
  onChange: (value: ProxyConfig) => void;
}) {
  const loadBalanced = value.targets !== undefined;
  const update = (patch: Partial<ProxyConfig>) => onChange({ ...value, ...patch });

  return (
    <FeatureSection
      id="proxy"
      title="Upstream"
      description="Choose where requests go and how the gateway connects."
      enabled
      required
    >
      <div className="segmented-control" aria-label="Upstream mode">
        <button
          type="button"
          className={!loadBalanced ? "active" : ""}
          onClick={() =>
            onChange({
              ...value,
              targets: undefined,
              strategy: undefined,
              stickyKey: undefined,
              target: value.target ?? "http://localhost:4000",
            })
          }
        >
          Single target
        </button>
        <button
          type="button"
          className={loadBalanced ? "active" : ""}
          onClick={() =>
            onChange({
              ...value,
              target: undefined,
              targets: value.targets ?? [
                { url: "http://localhost:4001" },
                { url: "http://localhost:4002" },
              ],
              strategy: value.strategy ?? "round-robin",
            })
          }
        >
          Load balanced
        </button>
      </div>

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
          {value.strategy === "sticky" ? (
            <FormField label="Sticky key" hint='Use ip or a source such as "cookie:session_id".'>
              <TextInput
                value={value.stickyKey ?? "ip"}
                onChange={(event) => update({ stickyKey: event.target.value })}
              />
            </FormField>
          ) : null}
          <div className="collection-editor">
            {(value.targets ?? []).map((target, index) => (
              <div className="collection-row collection-row--target" key={index}>
                <TextInput
                  aria-label={`Target ${index + 1} URL`}
                  type="url"
                  value={target.url}
                  onChange={(event) => {
                    const targets = [...(value.targets ?? [])];
                    targets[index] = { ...target, url: event.target.value };
                    update({ targets });
                  }}
                />
                <NumberInput
                  aria-label={`Target ${index + 1} weight`}
                  min={1}
                  value={target.weight}
                  onValue={(weight) => {
                    const targets = [...(value.targets ?? [])];
                    targets[index] = { ...target, weight };
                    update({ targets });
                  }}
                  placeholder="Weight"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove target ${index + 1}`}
                  disabled={(value.targets?.length ?? 0) <= 2}
                  onClick={() =>
                    update({
                      targets: value.targets?.filter((_, targetIndex) => targetIndex !== index),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
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

      <div className="form-grid form-grid--top-gap">
        <FormField label="HTTP method">
          <SelectInput
            value={value.method ?? ""}
            onChange={(event) =>
              update({ method: (event.target.value || undefined) as ProxyConfig["method"] })
            }
          >
            <option value="">Preserve incoming method</option>
            {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((method) => (
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
          onChange={(ws) => update({ ws })}
          label="Proxy WebSockets"
        />
      </div>
      <div className="subsection-grid">
        <div className="nested-panel nested-panel--flush">
          <Toggle
            checked={value.upstreamAuth !== undefined}
            onChange={(enabled) =>
              update({ upstreamAuth: enabled ? { type: "hmac-sha256", secret: "" } : undefined })
            }
            label="Sign upstream requests"
          />
          {value.upstreamAuth ? (
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
          ) : null}
        </div>
        <div className="nested-panel nested-panel--flush">
          <Toggle
            checked={value.mirror !== undefined}
            onChange={(enabled) =>
              update({
                mirror: enabled ? { target: "http://localhost:4400", percentage: 100 } : undefined,
              })
            }
            label="Mirror traffic"
          />
          {value.mirror ? (
            <div className="form-grid form-grid--top-gap">
              <FormField
                label="Mirror target"
                hint="Fire-and-forget target. Requires retries on this route."
                wide
              >
                <TextInput
                  type="url"
                  value={value.mirror.target}
                  onChange={(event) =>
                    update({ mirror: { ...value.mirror!, target: event.target.value } })
                  }
                />
              </FormField>
              <FormField label="Traffic percentage" hint="0 to 100." wide>
                <NumberInput
                  min={0}
                  max={100}
                  value={value.mirror.percentage}
                  onValue={(percentage) => update({ mirror: { ...value.mirror!, percentage } })}
                  placeholder="100"
                />
              </FormField>
            </div>
          ) : null}
          {value.mirror && !retryEnabled ? (
            <div className="inline-warning">
              Enable retries for this route to activate traffic mirroring.
            </div>
          ) : null}
        </div>
      </div>
      <div className="subsection-grid">
        <div>
          <h3>Path rewrites</h3>
          <p>Regular expression and replacement pairs.</p>
          <KeyValueEditor
            value={value.pathRewrite}
            onChange={(pathRewrite) => update({ pathRewrite })}
            keyPlaceholder="^/api"
            valuePlaceholder=""
          />
        </div>
        <div>
          <h3>Upstream headers</h3>
          <p>Headers added to every proxied request.</p>
          <KeyValueEditor
            value={value.headers}
            onChange={(headers) => update({ headers })}
            keyPlaceholder="X-Service-Key"
            valuePlaceholder="Value"
          />
        </div>
      </div>
    </FeatureSection>
  );
}
