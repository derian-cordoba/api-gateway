import { HttpMethod } from "@shared/http/HttpMethod";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      version: 2,
      sections: [
        { id: "proxy", label: "Upstream", required: true },
        { id: "validation", label: "Request validation", required: false },
        { id: "webhook", label: "Webhook verification", required: false },
        { id: "authentication", label: "Authentication", required: false },
        { id: "rateLimit", label: "Rate limiting", required: false },
        { id: "circuitBreaker", label: "Circuit breaker", required: false },
        { id: "retry", label: "Retries", required: false },
        { id: "cache", label: "Response cache", required: false },
        { id: "ipFilter", label: "IP filtering", required: false },
        { id: "headers", label: "Header transforms", required: false },
        { id: "cors", label: "CORS", required: false },
      ],
      methods: Object.values(HttpMethod),
      loadBalancingStrategies: ["round-robin", "weighted", "least-connections", "sticky"],
      authenticationStrategies: ["jwt", "apiKey", "basicAuth", "oauth2"],
      retryBackoffs: ["fixed", "exponential", "exponential-jitter"],
      webhookProviders: ["github", "stripe", "custom"],
      upstreamAuthTypes: ["hmac-sha256"],
      capabilities: [
        "jwt-forward-claims",
        "request-validation",
        "webhook-verification",
        "upstream-auth",
        "traffic-mirroring",
        "circuit-breaker-fallback",
        "retry-fallback",
        "request-collapsing",
        "ipv6-filtering",
      ],
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
