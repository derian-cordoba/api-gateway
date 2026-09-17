"use client";

import { useState } from "react";
import { Code2 } from "lucide-react";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { ProxyEditor } from "@/modules/proxy/components/ProxyEditor";
import { AuthenticationEditor } from "@/modules/authentication/components/AuthenticationEditor";
import { RateLimitEditor } from "@/modules/rate-limit/components/RateLimitEditor";
import { CircuitBreakerEditor } from "@/modules/circuit-breaker/components/CircuitBreakerEditor";
import { RetryEditor } from "@/modules/retry/components/RetryEditor";
import { CacheEditor } from "@/modules/cache/components/CacheEditor";
import { IpFilterEditor } from "@/modules/ip-filter/components/IpFilterEditor";
import { HeadersEditor } from "@/modules/headers/components/HeadersEditor";
import { CorsEditor } from "@/modules/cors/components/CorsEditor";
import { FormField, TextInput } from "@/modules/shared/components/FormControls";

export function RouteEditor({ value, onChange }: { value: GatewayRoute; onChange: (value: GatewayRoute) => void }) {
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2));
  const [rawError, setRawError] = useState("");
  const patch = (next: Partial<GatewayRoute>) => onChange({ ...value, ...next });

  const toggleRaw = () => {
    if (rawMode) {
      try {
        onChange(JSON.parse(raw) as GatewayRoute);
        setRawError("");
        setRawMode(false);
      } catch {
        setRawError("The JSON is not valid yet.");
      }
    } else {
      setRaw(JSON.stringify(value, null, 2));
      setRawMode(true);
    }
  };

  return <>
    <section className="route-basics">
      <div><span className="eyebrow">Request matching</span><h2>Route identity</h2><p>The prefix clients use to reach this upstream.</p></div>
      <FormField label="Base URL"><TextInput value={value.baseURL} onChange={(event) => patch({ baseURL: event.target.value })} placeholder="/products" /></FormField>
      <button type="button" className="button button--quiet button--small" onClick={toggleRaw}><Code2 size={16} /> {rawMode ? "Apply JSON" : "Edit JSON"}</button>
    </section>
    {rawMode ? <section className="raw-editor"><textarea className="input textarea code-input" rows={28} value={raw} onChange={(event) => setRaw(event.target.value)} spellCheck={false} />{rawError ? <p className="field-error">{rawError}</p> : null}</section> : <div className="feature-stack">
      <ProxyEditor value={value.proxy} onChange={(proxy) => patch({ proxy })} />
      <AuthenticationEditor value={value.auth} onChange={(auth) => patch({ auth })} />
      <RateLimitEditor value={value.rateLimit} onChange={(rateLimit) => patch({ rateLimit })} />
      <CircuitBreakerEditor value={value.circuitBreaker} onChange={(circuitBreaker) => patch({ circuitBreaker })} />
      <RetryEditor value={value.retry} onChange={(retry) => patch({ retry })} />
      <CacheEditor value={value.cache} onChange={(cache) => patch({ cache })} />
      <IpFilterEditor value={value.ipFilter} onChange={(ipFilter) => patch({ ipFilter })} />
      <HeadersEditor value={value.headers} onChange={(headers) => patch({ headers })} />
      <CorsEditor value={value.cors} onChange={(cors) => patch({ cors })} />
    </div>}
  </>;
}
