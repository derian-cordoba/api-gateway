import type { RouteOverview } from "@/server/gateway/contracts";

export type OverviewTotals = {
  requests: number;
  serverErrors: number;
  averageLatencyMs: number | null;
};

const ROUTE_PRIORITY = {
  HEALTHY: 0,
  SERVER_ERRORS: 1,
  OPEN_CIRCUIT: 2,
} as const;

type RoutePriority = (typeof ROUTE_PRIORITY)[keyof typeof ROUTE_PRIORITY];

export function getOverviewTotals(routes: RouteOverview[]): OverviewTotals {
  const requests = routes.reduce(
    (total, route) => total + route.requestsTotal,
    0,
  );
  const serverErrors = routes.reduce(
    (total, route) => total + route.serverErrorsTotal,
    0,
  );
  const weightedLatency = routes.reduce(
    (total, route) =>
      total + (route.averageLatencyMs ?? 0) * route.requestsTotal,
    0,
  );

  return {
    requests,
    serverErrors,
    averageLatencyMs: requests ? weightedLatency / requests : null,
  };
}

export function getVisibleRoutes(
  routes: RouteOverview[],
  failingOnly: boolean,
): RouteOverview[] {
  return routes
    .filter((route) => !failingOnly || isFailing(route))
    .sort(compareRoutes);
}

export function isFailing(route: RouteOverview): boolean {
  return route.circuitState === "OPEN" || route.serverErrorsTotal > 0;
}

function compareRoutes(left: RouteOverview, right: RouteOverview): number {
  const leftPriority = routePriority(left);
  const rightPriority = routePriority(right);

  return (
    rightPriority - leftPriority ||
    right.serverErrorsTotal - left.serverErrorsTotal ||
    left.baseURL.localeCompare(right.baseURL)
  );
}

function routePriority(route: RouteOverview): RoutePriority {
  if (route.circuitState === "OPEN") {
    return ROUTE_PRIORITY.OPEN_CIRCUIT;
  }

  return route.serverErrorsTotal > 0
    ? ROUTE_PRIORITY.SERVER_ERRORS
    : ROUTE_PRIORITY.HEALTHY;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
