"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { FormField, StringListInput } from "@/modules/shared/components/FormControls";

type Config = NonNullable<GatewayRoute["ipFilter"]>;

export function IpFilterEditor({
  value,
  onChange,
}: {
  value?: Config;
  onChange: (value?: Config) => void;
}) {
  const config = value ?? { deny: ["192.0.2.1"] };
  return (
    <FeatureSection
      id="ipFilter"
      title="IP filtering"
      description="Allow or block IPv4, IPv6, and CIDR ranges."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? config : undefined)}
    >
      <div className="form-grid">
        <FormField label="Allowed addresses" hint="When set, all other addresses are rejected.">
          <StringListInput
            value={config.allow}
            onChange={(allow) => onChange({ ...config, allow })}
            placeholder="10.0.0.0/8"
          />
        </FormField>
        <FormField label="Denied addresses" hint="Denied addresses are evaluated first.">
          <StringListInput
            value={config.deny}
            onChange={(deny) => onChange({ ...config, deny })}
            placeholder={"192.0.2.1\n2001:db8::/32"}
          />
        </FormField>
      </div>
    </FeatureSection>
  );
}
