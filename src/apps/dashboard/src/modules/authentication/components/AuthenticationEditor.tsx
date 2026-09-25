"use client";

import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import { FormField, SelectInput, Toggle } from "@/modules/shared/components/FormControls";
import { omitUndefined } from "@shared/objects/omitUndefined";
import type { Auth } from "../authentication-editor.types";
import { authDefaults } from "../auth-defaults";
import { AuthStrategyFields } from "./AuthStrategyFields";
import { AuthRateLimitFields } from "./AuthRateLimitFields";

export function AuthenticationEditor({
  value,
  onChange,
}: {
  value?: Auth;
  onChange: (value?: Auth) => void;
}) {
  const auth = value ?? authDefaults.jwt;
  const update = (patch: Partial<Auth>) => onChange(omitUndefined({ ...auth, ...patch }) as Auth);

  return (
    <FeatureSection
      id="authentication"
      title="Authentication"
      description="Protect this route with a token, API key, or credentials."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? authDefaults.jwt : undefined)}
    >
      <div className="form-grid">
        <FormField label="Strategy">
          <SelectInput
            value={auth.strategy}
            onChange={(event) => onChange(authDefaults[event.target.value as Auth["strategy"]])}
          >
            <option value="jwt">JWT</option>
            <option value="apiKey">API key</option>
            <option value="basicAuth">Basic authentication</option>
            <option value="oauth2">OAuth 2.0 introspection</option>
          </SelectInput>
        </FormField>
        <div className="form-field form-field--toggle">
          <Toggle
            checked={auth.enabled}
            onChange={(enabled) => update({ enabled })}
            label="Authentication active"
          />
        </div>
      </div>

      <AuthStrategyFields value={auth} onChange={onChange} />

      <AuthRateLimitFields
        value={auth.authRateLimit}
        onChange={(authRateLimit) => update({ authRateLimit } as Partial<Auth>)}
      />
    </FeatureSection>
  );
}
