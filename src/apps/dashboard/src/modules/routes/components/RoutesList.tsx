import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { RouteCard } from "./RouteCard";
import { EmptyRoutes } from "./EmptyRoutes";
import { NoMatchingRoutes } from "./NoMatchingRoutes";

type IndexedRoute = { route: GatewayRoute; index: number };

export function RoutesList({
  routes,
  filtered,
  loading,
  onDuplicate,
  onDelete,
}: {
  routes: GatewayRoute[];
  filtered: IndexedRoute[];
  loading: boolean;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  if (loading) {
    return (
      <div className="route-list">
        {[0, 1, 2].map((item) => (
          <div className="skeleton-card" key={item} />
        ))}
      </div>
    );
  }

  if (routes.length === 0) {
    return <EmptyRoutes />;
  }

  if (filtered.length === 0) {
    return <NoMatchingRoutes />;
  }

  return (
    <div className="route-list">
      {filtered.map(({ route, index }) => (
        <RouteCard
          key={`${route.baseURL}-${index}`}
          route={route}
          index={index}
          onDuplicate={() => onDuplicate(index)}
          onDelete={() => onDelete(index)}
        />
      ))}
    </div>
  );
}
