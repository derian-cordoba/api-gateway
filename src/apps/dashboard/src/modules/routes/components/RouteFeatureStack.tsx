"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { ProxyEditor } from "@/modules/proxy/components/ProxyEditor";
import { ValidationEditor } from "@/modules/validation/components/ValidationEditor";
import { WebhookEditor } from "@/modules/webhook/components/WebhookEditor";
import { AuthenticationEditor } from "@/modules/authentication/components/AuthenticationEditor";
import { RateLimitEditor } from "@/modules/rate-limit/components/RateLimitEditor";
import { CircuitBreakerEditor } from "@/modules/circuit-breaker/components/CircuitBreakerEditor";
import { RetryEditor } from "@/modules/retry/components/RetryEditor";
import { CacheEditor } from "@/modules/cache/components/CacheEditor";
import { IpFilterEditor } from "@/modules/ip-filter/components/IpFilterEditor";
import { HeadersEditor } from "@/modules/headers/components/HeadersEditor";
import { CorsEditor } from "@/modules/cors/components/CorsEditor";

export function RouteFeatureStack({
  value,
  onPatch,
}: {
  value: GatewayRoute;
  onPatch: (patch: Partial<GatewayRoute>) => void;
}) {
  return (
    <div className="feature-stack">
      <ProxyEditor
        value={value.proxy}
        retryEnabled={value.retry !== undefined}
        onChange={(proxy) => onPatch({ proxy })}
      />
      <ValidationEditor
        value={value.validation}
        onChange={(validation) => onPatch({ validation })}
      />
      <WebhookEditor value={value.webhook} onChange={(webhook) => onPatch({ webhook })} />
      <AuthenticationEditor value={value.auth} onChange={(auth) => onPatch({ auth })} />
      <RateLimitEditor value={value.rateLimit} onChange={(rateLimit) => onPatch({ rateLimit })} />
      <CircuitBreakerEditor
        value={value.circuitBreaker}
        onChange={(circuitBreaker) => onPatch({ circuitBreaker })}
      />
      <RetryEditor value={value.retry} onChange={(retry) => onPatch({ retry })} />
      <CacheEditor value={value.cache} onChange={(cache) => onPatch({ cache })} />
      <IpFilterEditor value={value.ipFilter} onChange={(ipFilter) => onPatch({ ipFilter })} />
      <HeadersEditor value={value.headers} onChange={(headers) => onPatch({ headers })} />
      <CorsEditor value={value.cors} onChange={(cors) => onPatch({ cors })} />
    </div>
  );
}
