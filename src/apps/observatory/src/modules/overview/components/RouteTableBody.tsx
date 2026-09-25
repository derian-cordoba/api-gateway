import type { RouteOverview } from "@/server/gateway/contracts";
import { EmptyRouteRow } from "./EmptyRouteRow";
import { RouteTableRow } from "./RouteTableRow";

export function RouteTableBody({ routes }: { routes: RouteOverview[] }) {
  return (
    <tbody>
      {routes.length > 0 ? (
        routes.map((route) => (
          <RouteTableRow key={route.baseURL} route={route} />
        ))
      ) : (
        <EmptyRouteRow />
      )}
    </tbody>
  );
}
