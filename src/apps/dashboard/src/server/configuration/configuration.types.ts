import type {
  GatewayRoute,
  StoredRouteConfig,
  ConfigurationHistoryEntry,
} from "../../../../../modules/route-configuration/domain/types";
export type {
  GatewayRoute,
  StoredRouteConfig,
  ConfigurationHistoryEntry,
  ConfigurationWarning,
} from "../../../../../modules/route-configuration/domain/types";

export interface RouteConfigStore {
  read(): Promise<StoredRouteConfig>;
  write(routes: GatewayRoute[], expectedRevision?: string): Promise<StoredRouteConfig>;
  listHistory?(): Promise<ConfigurationHistoryEntry[]>;
  restore?(revision: string, expectedRevision?: string): Promise<StoredRouteConfig>;
}
