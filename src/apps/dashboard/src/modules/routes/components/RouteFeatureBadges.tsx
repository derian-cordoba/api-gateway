import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export function RouteFeatureBadges({ route }: { route: GatewayRoute }) {
  const features = [
    route.auth && "Auth",
    route.validation && "Validation",
    route.webhook && "Webhook",
    route.rateLimit && "Rate limit",
    route.circuitBreaker && "Circuit breaker",
    route.retry && "Retry",
    route.cache && "Cache",
    route.ipFilter && "IP filter",
    route.cors && "CORS",
    route.proxy.upstreamAuth && "Signed upstream",
    route.proxy.mirror && "Mirroring",
    route.proxy.ws && "WebSocket",
  ].filter((feature): feature is string => typeof feature === "string");

  return (
    <div className="route-card__features">
      {features.length > 0 ? (
        features.map((feature) => (
          <span className="badge" key={feature}>
            {feature}
          </span>
        ))
      ) : (
        <span className="muted">Direct proxy</span>
      )}
    </div>
  );
}
