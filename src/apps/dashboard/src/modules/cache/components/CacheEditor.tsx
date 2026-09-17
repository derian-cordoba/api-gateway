"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { FormField, NumberInput, NumberListInput, StringListInput } from "@/modules/shared/components/FormControls";

type Config = NonNullable<GatewayRoute["cache"]>;

export function CacheEditor({ value, onChange }: { value?: Config; onChange: (value?: Config) => void }) {
  const config = value ?? { ttl: 30_000 };
  const update = (patch: Partial<Config>) => onChange({ ...config, ...patch });
  return <FeatureSection id="cache" title="Response cache" description="Serve reusable upstream responses from memory." enabled={value !== undefined} onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}>
    <div className="form-grid">
      <FormField label="Time to live" hint="Milliseconds"><NumberInput min={1} value={config.ttl} onValue={(ttl) => update({ ttl: ttl ?? 1 })} /></FormField>
      <FormField label="Stale while revalidate" hint="Optional milliseconds"><NumberInput min={1} value={config.staleWhileRevalidateMs} onValue={(staleWhileRevalidateMs) => update({ staleWhileRevalidateMs })} /></FormField>
      <FormField label="Eviction interval" hint="Minimum 1000 milliseconds"><NumberInput min={1000} value={config.evictionIntervalMs} onValue={(evictionIntervalMs) => update({ evictionIntervalMs })} /></FormField>
      <FormField label="Cacheable status codes"><NumberListInput value={config.statusCodes} onChange={(statusCodes) => update({ statusCodes })} placeholder="200, 203, 204" /></FormField>
      <FormField label="Cacheable methods" wide><StringListInput value={config.methods} onChange={(methods) => update({ methods })} placeholder="GET, HEAD" /></FormField>
    </div>
  </FeatureSection>;
}
