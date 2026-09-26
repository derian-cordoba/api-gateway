import type { z } from "zod";
import type { GatewaySchema } from "./validation/gateway.schema";

export type GatewayRoute = z.infer<typeof GatewaySchema>;

export type ConfigurationWarning = {
  path: Array<string | number>;
  message: string;
};

export type StorageStatus = {
  driver: string;
  environment?: string;
  configurationKey: string;
  schemaVersion: number;
};

export type RouteRevision = {
  revision: string;
  version: number;
  routes: GatewayRoute[];
  updatedAt: string;
  checksum: string;
  restoredFrom?: string;
  legacyRevision?: string;
};

export type ConfigurationHistoryEntry = Pick<
  RouteRevision,
  "revision" | "updatedAt"
> & { version?: number; restoredFrom?: string };

export type StoredRouteConfig = {
  routes: GatewayRoute[];
  revision: string;
  updatedAt: string | null;
  warnings: ConfigurationWarning[];
  storage?: StorageStatus;
  // Present only for the transitional file driver
  filePath?: string;
};

export interface RouteConfigurationRepository {
  migrate(): Promise<void>;
  checkSchema(): Promise<void>;
  read(): Promise<RouteRevision | null>;
  head(): Promise<string | null>;
  history(limit: number, offset: number): Promise<ConfigurationHistoryEntry[]>;
  find(revision: string): Promise<RouteRevision | null>;
  commit(
    revision: RouteRevision,
    expectedRevision: string,
    historyLimit: number,
  ): Promise<RouteRevision>;
  // Atomic, idempotent bootstrap. Never replaces an existing configuration.
  initialize(revisions: RouteRevision[], importId: string): Promise<void>;
  close(): Promise<void>;
}
