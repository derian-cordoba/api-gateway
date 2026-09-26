export type RouteSourceSummary = {
  id: string;
  name: string;
  driver: "local-json" | "sqlite" | "postgres" | "mongodb";
  environment?: "development" | "production";
  configurationKey: string;
};

export type SourceSelection = { sourceId: string; version: number };

export type SourceRuntimeStatus = {
  instanceId: string;
  desired: SourceSelection;
  applied: SourceSelection | null;
  revision: string | null;
  status: "synchronized" | "degraded";
  activationEnabled: boolean;
};
