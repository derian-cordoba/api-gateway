"use client";

import { Plus, Trash2 } from "lucide-react";
import type {
  AuthRateLimit,
  GatewayRoute,
} from "@/modules/configuration/types/configuration.types";
import { FeatureSection } from "@/modules/shared/components/FeatureSection";
import {
  FormField,
  KeyValueEditor,
  NumberInput,
  SelectInput,
  StringListInput,
  TextInput,
  Toggle,
} from "@/modules/shared/components/FormControls";

type Auth = NonNullable<GatewayRoute["auth"]>;

const defaults: Record<Auth["strategy"], Auth> = {
  jwt: { enabled: true, strategy: "jwt", secret: "" },
  apiKey: { enabled: true, strategy: "apiKey", header: "x-api-key", keys: [""] },
  basicAuth: {
    enabled: true,
    strategy: "basicAuth",
    realm: "API Gateway",
    credentials: [{ username: "", password: "" }],
  },
  oauth2: {
    enabled: true,
    strategy: "oauth2",
    introspectionUrl: "",
    clientId: "",
    clientSecret: "",
  },
};

export function AuthenticationEditor({
  value,
  onChange,
}: {
  value?: Auth;
  onChange: (value?: Auth) => void;
}) {
  const auth = value ?? defaults.jwt;
  const update = (patch: Partial<Auth>) => onChange({ ...auth, ...patch } as Auth);

  return (
    <FeatureSection
      id="authentication"
      title="Authentication"
      description="Protect this route with a token, API key, or credentials."
      enabled={value !== undefined}
      onEnabledChange={(enabled) => onChange(enabled ? defaults.jwt : undefined)}
    >
      <div className="form-grid">
        <FormField label="Strategy">
          <SelectInput
            value={auth.strategy}
            onChange={(event) => onChange(defaults[event.target.value as Auth["strategy"]])}
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

      {auth.strategy === "jwt" ? <JwtFields value={auth} onChange={onChange} /> : null}
      {auth.strategy === "apiKey" ? <ApiKeyFields value={auth} onChange={onChange} /> : null}
      {auth.strategy === "basicAuth" ? <BasicFields value={auth} onChange={onChange} /> : null}
      {auth.strategy === "oauth2" ? <OAuthFields value={auth} onChange={onChange} /> : null}

      <AuthRateLimitFields
        value={auth.authRateLimit}
        onChange={(authRateLimit) => update({ authRateLimit } as Partial<Auth>)}
      />
    </FeatureSection>
  );
}

function JwtFields({
  value,
  onChange,
}: {
  value: Extract<Auth, { strategy: "jwt" }>;
  onChange: (value: Auth) => void;
}) {
  const update = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="form-grid form-grid--top-gap">
      <FormField label="HMAC secret" hint="Use one credential source. JWKS takes precedence.">
        <TextInput
          type="password"
          value={value.secret ?? ""}
          onChange={(event) => update({ secret: event.target.value || undefined })}
          autoComplete="new-password"
        />
      </FormField>
      <FormField label="JWKS URL">
        <TextInput
          type="url"
          value={value.jwksUri ?? ""}
          onChange={(event) => update({ jwksUri: event.target.value || undefined })}
          placeholder="https://issuer/.well-known/jwks.json"
        />
      </FormField>
      <FormField label="Public key" wide>
        <textarea
          className="input textarea code-input"
          rows={4}
          value={value.publicKey ?? ""}
          onChange={(event) => update({ publicKey: event.target.value || undefined })}
          placeholder="-----BEGIN PUBLIC KEY-----"
        />
      </FormField>
      <FormField label="Allowed algorithms" hint="One per line or comma separated.">
        <StringListInput
          value={value.algorithms}
          onChange={(algorithms) => update({ algorithms })}
          placeholder="RS256"
        />
      </FormField>
      <FormField
        label="Forward claims"
        hint="Map JWT claim names to upstream request header names."
        wide
      >
        <KeyValueEditor
          value={value.forwardClaims}
          onChange={(forwardClaims) => update({ forwardClaims })}
          keyPlaceholder="Claim, e.g. sub"
          valuePlaceholder="Header, e.g. X-User-Id"
        />
      </FormField>
    </div>
  );
}

function ApiKeyFields({
  value,
  onChange,
}: {
  value: Extract<Auth, { strategy: "apiKey" }>;
  onChange: (value: Auth) => void;
}) {
  return (
    <div className="form-grid form-grid--top-gap">
      <FormField label="Header name">
        <TextInput
          value={value.header ?? ""}
          onChange={(event) => onChange({ ...value, header: event.target.value || undefined })}
          placeholder="x-api-key"
        />
      </FormField>
      <FormField label="Accepted keys" hint="One key per line.">
        <StringListInput
          value={value.keys}
          onChange={(keys) => onChange({ ...value, keys: keys ?? [] })}
        />
      </FormField>
    </div>
  );
}

function BasicFields({
  value,
  onChange,
}: {
  value: Extract<Auth, { strategy: "basicAuth" }>;
  onChange: (value: Auth) => void;
}) {
  return (
    <div className="stack form-grid--top-gap">
      <FormField label="Realm">
        <TextInput
          value={value.realm ?? ""}
          onChange={(event) => onChange({ ...value, realm: event.target.value || undefined })}
        />
      </FormField>
      <div className="collection-editor">
        {value.credentials.map((credential, index) => (
          <div className="collection-row" key={index}>
            <TextInput
              aria-label={`Username ${index + 1}`}
              value={credential.username}
              placeholder="Username"
              onChange={(event) => {
                const credentials = [...value.credentials];
                credentials[index] = { ...credential, username: event.target.value };
                onChange({ ...value, credentials });
              }}
            />
            <TextInput
              aria-label={`Password ${index + 1}`}
              type="password"
              autoComplete="new-password"
              value={credential.password}
              placeholder="Password"
              onChange={(event) => {
                const credentials = [...value.credentials];
                credentials[index] = { ...credential, password: event.target.value };
                onChange({ ...value, credentials });
              }}
            />
            <button
              className="icon-button"
              type="button"
              aria-label={`Remove credential ${index + 1}`}
              disabled={value.credentials.length <= 1}
              onClick={() =>
                onChange({
                  ...value,
                  credentials: value.credentials.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          className="button button--quiet button--small"
          type="button"
          onClick={() =>
            onChange({
              ...value,
              credentials: [...value.credentials, { username: "", password: "" }],
            })
          }
        >
          <Plus size={15} /> Add credential
        </button>
      </div>
    </div>
  );
}

function OAuthFields({
  value,
  onChange,
}: {
  value: Extract<Auth, { strategy: "oauth2" }>;
  onChange: (value: Auth) => void;
}) {
  const update = (patch: Partial<typeof value>) => onChange({ ...value, ...patch });
  return (
    <div className="form-grid form-grid--top-gap">
      <FormField label="Introspection URL" wide>
        <TextInput
          type="url"
          value={value.introspectionUrl}
          onChange={(event) => update({ introspectionUrl: event.target.value })}
        />
      </FormField>
      <FormField label="Client ID">
        <TextInput
          value={value.clientId}
          onChange={(event) => update({ clientId: event.target.value })}
        />
      </FormField>
      <FormField label="Client secret">
        <TextInput
          type="password"
          autoComplete="new-password"
          value={value.clientSecret}
          onChange={(event) => update({ clientSecret: event.target.value })}
        />
      </FormField>
      <FormField label="Token type hint">
        <TextInput
          value={value.tokenTypeHint ?? ""}
          onChange={(event) => update({ tokenTypeHint: event.target.value || undefined })}
          placeholder="access_token"
        />
      </FormField>
      <FormField label="Introspection cache TTL" hint="Milliseconds">
        <NumberInput
          min={1}
          value={value.introspectionCacheTtlMs}
          onValue={(introspectionCacheTtlMs) => update({ introspectionCacheTtlMs })}
        />
      </FormField>
    </div>
  );
}

function AuthRateLimitFields({
  value,
  onChange,
}: {
  value?: AuthRateLimit;
  onChange: (value?: AuthRateLimit) => void;
}) {
  return (
    <div className="nested-panel">
      <Toggle
        checked={value !== undefined}
        onChange={(enabled) => onChange(enabled ? { max: 5, windowMs: 60_000 } : undefined)}
        label="Limit failed authentication attempts"
      />
      {value && (
        <div className="form-grid form-grid--top-gap">
          <FormField label="Maximum failures">
            <NumberInput
              min={1}
              value={value.max}
              onValue={(max) => onChange({ ...value, max: max ?? 1 })}
            />
          </FormField>
          <FormField label="Window" hint="Milliseconds">
            <NumberInput
              min={1}
              value={value.windowMs}
              onValue={(windowMs) => onChange({ ...value, windowMs: windowMs ?? 1 })}
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
