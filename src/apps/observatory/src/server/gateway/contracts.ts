export type RouteOverview = {
  baseURL: string;
  requestsTotal: number;
  clientErrorsTotal: number;
  serverErrorsTotal: number;
  averageLatencyMs: number | null;
  cacheHitsTotal: number;
  cacheStaleHitsTotal: number;
  rateLimitRejectionsTotal: number;
  circuitState: string | null;
};

export type GatewayOverview = {
  apiVersion: 1;
  timestamp: string;
  ready: boolean;
  uptimeSeconds: number;
  version: string;
  routeCount: number;
  lastRouteReloadedAt: string | null;
  routes: RouteOverview[];
};

export type GatewayEvent = {
  id: string;
  timestamp: string;
  type: "route-reloaded" | "circuit-state-change" | "rate-limit-exceeded";
  route?: string;
  message: string;
};

export type GatewayEvents = {
  events: GatewayEvent[];
  nextCursor: string | null;
};
