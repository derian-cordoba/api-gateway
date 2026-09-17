import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      version: 1,
      sections: [
        { id: "proxy", label: "Upstream", required: true },
        { id: "authentication", label: "Authentication", required: false },
        { id: "rateLimit", label: "Rate limiting", required: false },
        { id: "circuitBreaker", label: "Circuit breaker", required: false },
        { id: "retry", label: "Retries", required: false },
        { id: "cache", label: "Response cache", required: false },
        { id: "ipFilter", label: "IP filtering", required: false },
        { id: "headers", label: "Header transforms", required: false },
        { id: "cors", label: "CORS", required: false },
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      loadBalancingStrategies: ["round-robin", "weighted", "least-connections", "sticky"],
      authenticationStrategies: ["jwt", "apiKey", "basicAuth", "oauth2"],
      retryBackoffs: ["fixed", "exponential", "exponential-jitter"],
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
