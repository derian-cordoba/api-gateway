"use client";

import Link from "next/link";
import { Copy, Pencil, Trash2 } from "lucide-react";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export function RouteCard({
  route,
  index,
  onDuplicate,
  onDelete,
}: {
  route: GatewayRoute;
  index: number;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const target = route.proxy.target ?? `${route.proxy.targets?.length ?? 0} upstream targets`;
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
  ].filter(Boolean) as string[];

  return (
    <article className="route-card">
      <div className="route-card__identity">
        <div className="route-card__method">{route.proxy.method ?? "ANY"}</div>
        <div>
          <h2>{route.baseURL}</h2>
          <p>{target}</p>
        </div>
      </div>
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
      <div className="route-card__actions">
        <button
          type="button"
          className="icon-button"
          onClick={onDuplicate}
          aria-label={`Duplicate ${route.baseURL}`}
        >
          <Copy size={17} />
        </button>
        <Link
          className="icon-button"
          href={`/routes/edit?index=${index}`}
          aria-label={`Edit ${route.baseURL}`}
        >
          <Pencil size={17} />
        </Link>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={onDelete}
          aria-label={`Delete ${route.baseURL}`}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );
}
