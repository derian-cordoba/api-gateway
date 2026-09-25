"use client";

import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { RouteFeatureBadges } from "./RouteFeatureBadges";
import { RouteCardActions } from "./RouteCardActions";

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
  return (
    <article className="route-card">
      <div className="route-card__identity">
        <div className="route-card__method">{route.proxy.method ?? "ANY"}</div>
        <div>
          <h2>{route.baseURL}</h2>
          <p>{target}</p>
        </div>
      </div>
      <RouteFeatureBadges route={route} />
      <RouteCardActions
        baseURL={route.baseURL}
        index={index}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </article>
  );
}
