"use client";

import type { ProxyConfig } from "./proxy-editor.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { omitUndefined } from "@shared/objects/omitUndefined";
import { UpstreamTargetFields } from "./fields/UpstreamTargetFields";
import { ProxyTransportFields } from "./fields/ProxyTransportFields";
import { ProxySecurityFields } from "./fields/ProxySecurityFields";
import { ProxyTransformFields } from "./fields/ProxyTransformFields";
import { UpstreamModeSelector } from "./UpstreamModeSelector";

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
  const update = (patch: Partial<ProxyConfig>) => onChange(omitUndefined({ ...value, ...patch }));

  return (
    <FeatureSection
      id="proxy"
      title="Upstream"
      description="Choose where requests go and how the gateway connects."
      enabled
      required
    >
      <UpstreamModeSelector value={value} onChange={onChange} />

      <UpstreamTargetFields value={value} loadBalanced={loadBalanced} update={update} />
      <ProxyTransportFields value={value} update={update} />
      <ProxySecurityFields value={value} retryEnabled={retryEnabled} update={update} />
      <ProxyTransformFields value={value} update={update} />
    </FeatureSection>
  );
}
