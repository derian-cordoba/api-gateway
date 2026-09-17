import type { z } from "zod";
import type { GatewaySchema } from "@gateway/routes/validators/gateway.schema";

export type GatewayRoute = z.infer<typeof GatewaySchema>;

export type ConfigurationWarning = {
  path: Array<string | number>;
  message: string;
};

export type StoredRouteConfig = {
  routes: GatewayRoute[];
  revision: string;
  updatedAt: string | null;
  filePath: string;
  warnings: ConfigurationWarning[];
};

export interface RouteConfigStore {
  read(): Promise<StoredRouteConfig>;
  write(routes: GatewayRoute[], expectedRevision?: string): Promise<StoredRouteConfig>;
}

