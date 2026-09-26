import type { Gateway } from "../types/gateway";
import type { MetricsCollector } from "../middleware/metrics/MetricsCollector";
import type { GatewayEvents } from "../middleware/GatewayEvents";
import { StatusCodes } from "http-status-codes";

const MAX_EVENTS = 1_000;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1_000;

export type GatewayOperationEvent = {
  id: string;
  timestamp: string;
  type: "route-reloaded" | "circuit-state-change" | "rate-limit-exceeded";
  route?: string;
  message: string;
};

export type GatewayRouteOverview = {
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

export type ConfigurationSyncState = {
  status: "synchronized" | "degraded";
  revision: string | null;
  message?: string;
};

export class GatewayOperationState {
  private readonly startedAt: number = Date.now();
  private readonly circuitStates = new Map<string, string>();
  private readonly rateLimitRejections = new Map<string, number>();
  private configurationSync?: ConfigurationSyncState;
  private ready: boolean = false;
  private routes: readonly Gateway[] = [];
  private lastRouteReloadedAt: string | null = null;
  private events: GatewayOperationEvent[] = [];
  private nextEventId: number = 1;

  setConfigurationSync(state: ConfigurationSyncState): void {
    this.configurationSync = state;
  }

  setReady(ready: boolean): void {
    this.ready = ready;
  }

  recordRoutes(routes: readonly Gateway[]): void {
    this.routes = routes;
    this.lastRouteReloadedAt = new Date().toISOString();
    const activeRoutes = new Set(routes.map((route) => route.baseURL));

    for (const route of this.circuitStates.keys()) {
      if (!activeRoutes.has(route.split(":")[0])) {
        this.circuitStates.delete(route);
      }
    }

    this.addEvent({
      type: "route-reloaded",
      message: `Loaded ${routes.length} route${routes.length === 1 ? "" : "s"}.`,
    });
  }

  recordCircuitState(payload: GatewayEvents["circuitBreaker:stateChange"][0]): void {
    this.circuitStates.set(payload.baseURL, payload.nextState);
    this.addEvent({
      type: "circuit-state-change",
      route: payload.baseURL,
      message: `Circuit changed from ${payload.previousState} to ${payload.nextState}.`,
    });
  }

  recordRateLimitExceeded(payload: GatewayEvents["rateLimit:exceeded"][0]): void {
    this.rateLimitRejections.set(
      payload.baseURL,
      (this.rateLimitRejections.get(payload.baseURL) ?? 0) + 1,
    );
    this.addEvent({
      type: "rate-limit-exceeded",
      route: payload.baseURL,
      message: "A request was rejected by this route's rate limit.",
    });
  }

  async getOverview(metrics: MetricsCollector): Promise<{
    apiVersion: 1;
    configurationSync?: ConfigurationSyncState;
    timestamp: string;
    ready: boolean;
    uptimeSeconds: number;
    version: string;
    routeCount: number;
    lastRouteReloadedAt: string | null;
    routes: GatewayRouteOverview[];
  }> {
    const [requests, durations, cacheHits, cacheStaleHits] = await Promise.all([
      metrics.requestsTotal.get(),
      metrics.requestDuration.get(),
      metrics.cacheHits.get(),
      metrics.cacheStaleHits.get(),
    ]);
    const byRoute = new Map<string, GatewayRouteOverview>();
    const ensure = (baseURL: string): GatewayRouteOverview => {
      const existing = byRoute.get(baseURL);
      if (existing) {
        return existing;
      }

      const overview: GatewayRouteOverview = {
        baseURL,
        requestsTotal: 0,
        clientErrorsTotal: 0,
        serverErrorsTotal: 0,
        averageLatencyMs: null,
        cacheHitsTotal: 0,
        cacheStaleHitsTotal: 0,
        rateLimitRejectionsTotal: this.rateLimitRejections.get(baseURL) ?? 0,
        circuitState: this.getCircuitState(baseURL),
      };

      byRoute.set(baseURL, overview);

      return overview;
    };

    for (const route of this.routes) {
      ensure(route.baseURL);
    }

    for (const value of requests.values) {
      const route = String(value.labels.route ?? "");
      if (!route) {
        continue;
      }

      const overview = ensure(route);
      const status = Number(value.labels.status_code ?? 0);
      overview.requestsTotal += value.value;

      if (status >= StatusCodes.BAD_REQUEST && status < StatusCodes.INTERNAL_SERVER_ERROR) {
        overview.clientErrorsTotal += value.value;
      }

      if (status >= StatusCodes.INTERNAL_SERVER_ERROR) {
        overview.serverErrorsTotal += value.value;
      }
    }

    const durationCounts = new Map<string, number>();
    const durationSums = new Map<string, number>();
    for (const value of durations.values) {
      const route = String(value.labels.route ?? "");
      if (!route) {
        continue;
      }

      if (value.metricName?.endsWith("_count")) {
        durationCounts.set(route, (durationCounts.get(route) ?? 0) + value.value);
      }

      if (value.metricName?.endsWith("_sum")) {
        durationSums.set(route, (durationSums.get(route) ?? 0) + value.value);
      }
    }

    for (const [route, count] of durationCounts) {
      if (count > 0) {
        ensure(route).averageLatencyMs = ((durationSums.get(route) ?? 0) / count) * 1_000;
      }
    }

    for (const value of cacheHits.values) {
      const route = String(value.labels.route ?? "");
      if (route) {
        ensure(route).cacheHitsTotal += value.value;
      }
    }

    for (const value of cacheStaleHits.values) {
      const route = String(value.labels.route ?? "");
      if (route) {
        ensure(route).cacheStaleHitsTotal += value.value;
      }
    }

    return {
      apiVersion: 1,
      configurationSync: this.configurationSync,
      timestamp: new Date().toISOString(),
      ready: this.ready,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1_000),
      version: process.env.npm_package_version || "unknown",
      routeCount: this.routes.length,
      lastRouteReloadedAt: this.lastRouteReloadedAt,
      routes: [...byRoute.values()]
        .sort((left, right) => left.baseURL.localeCompare(right.baseURL)),
    };
  }

  getEvents(cursor?: string, limit = 50, route?: string): { events: GatewayOperationEvent[]; nextCursor: string | null } {
    this.pruneEvents();
    const candidates = route
      ? this.events.filter((event) => event.route === route)
      : this.events;
    const offset = cursor
      ? candidates.findIndex((event) => event.id === cursor) + 1
      : 0;
    const start = Math.max(0, offset);
    const events = candidates.slice(start, start + limit);

    return {
      events,
      nextCursor: events.length === limit
        ? events.at(-1)?.id ?? null
        : null,
    };
  }

  private addEvent(event: Omit<GatewayOperationEvent, "id" | "timestamp">): void {
    this.events.unshift({
      id: String(this.nextEventId++),
      timestamp: new Date().toISOString(),
      ...event,
    });
    this.pruneEvents();
  }

  private getCircuitState(baseURL: string): string | null {
    const states = [
      this.circuitStates.get(baseURL),
      ...[...this.circuitStates]
        .filter(([key]) => key.startsWith(`${baseURL}:`))
        .map(([, state]) => state),
    ].filter((state): state is string => state !== undefined);

    if (states.includes("OPEN")) {
      return "OPEN";
    }

    if (states.includes("HALF_OPEN")) {
      return "HALF_OPEN";
    }

    return states.at(0) ?? null;
  }

  private pruneEvents(): void {
    const cutoff = Date.now() - MAX_EVENT_AGE_MS;
    this.events = this.events
      .filter((event) => Date.parse(event.timestamp) >= cutoff)
      .slice(0, MAX_EVENTS);
  }
}
