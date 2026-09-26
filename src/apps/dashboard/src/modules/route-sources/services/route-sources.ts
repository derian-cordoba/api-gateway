import { DashboardApiClient } from "@/modules/configuration/services/dashboard-api-client";
import { HttpMethod } from "@shared/http/HttpMethod";
import type {
  RouteSourceSummary,
  SourceRuntimeStatus,
} from "../../../../../../modules/route-sources/types";

export type { RouteSourceSummary, SourceRuntimeStatus };

export type SourceHealth = {
  sourceId: string;
  status: "ready";
  revision: string;
  routeCount: number;
};

export type SourcesResponse = {
  sources: RouteSourceSummary[];
  runtime: SourceRuntimeStatus | null;
  runtimeError: string | null;
};

class RouteSourcesService {
  private readonly client = new DashboardApiClient();

  list(signal?: AbortSignal): Promise<SourcesResponse> {
    return this.client.request("/api/route-sources", { signal });
  }

  check(id: string, signal?: AbortSignal): Promise<SourceHealth> {
    return this.client.request(`/api/route-sources/${encodeURIComponent(id)}/check`, {
      method: HttpMethod.POST,
      signal,
    });
  }

  activate(
    id: string,
    expectedVersion: number,
    expectedRevision: string,
  ): Promise<SourceRuntimeStatus> {
    return this.client.request(`/api/route-sources/${encodeURIComponent(id)}/activate`, {
      method: HttpMethod.POST,
      json: { expectedVersion, expectedRevision },
    });
  }
}

export const routeSourcesService = new RouteSourcesService();
