"use client";

import type { ProxyConfig, UpdateProxy } from "../proxy-editor.types";
import { UpstreamSigningFields } from "./UpstreamSigningFields";
import { TrafficMirrorFields } from "./TrafficMirrorFields";

export function ProxySecurityFields({
  value,
  retryEnabled,
  update,
}: {
  value: ProxyConfig;
  retryEnabled: boolean;
  update: UpdateProxy;
}) {
  return (
    <div className="subsection-grid">
      <UpstreamSigningFields value={value} update={update} />
      <TrafficMirrorFields value={value} retryEnabled={retryEnabled} update={update} />
    </div>
  );
}
