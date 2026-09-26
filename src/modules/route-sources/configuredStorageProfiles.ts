import type { RouteSourceSummary } from "./types";

export type ConnectionProfile = RouteSourceSummary & {
  connectionEnv: string;
  databaseEnv?: string;
};

export const RESERVED_STORAGE_SOURCE_ID =
  /^storage-(json|sqlite|(?:postgres|mongodb)-(?:development|production))$/;

/** Discover configured connections without exposing their values or changing the default driver. */
export function configuredStorageProfiles(
  env: NodeJS.ProcessEnv,
): ConnectionProfile[] {
  const profiles: ConnectionProfile[] = [];
  const configurationKey = env.ROUTE_CONFIGURATION_KEY?.trim() || "default";
  if (env.ROUTE_SQLITE_PATH?.trim() && env.ROUTE_STORAGE_DRIVER !== "sqlite") {
    profiles.push({
      id: "storage-sqlite",
      name: "SQLite",
      driver: "sqlite",
      configurationKey,
      connectionEnv: "ROUTE_SQLITE_PATH",
    });
  }

  for (const driver of ["postgres", "mongodb"] as const) {
    for (const environment of ["development", "production"] as const) {
      if (
        env.ROUTE_STORAGE_DRIVER === driver &&
        env.ROUTE_DATABASE_ENV === environment
      ) {
        continue;
      }

      const prefix = `ROUTE_${driver === "postgres" ? "POSTGRES" : "MONGODB"}_${environment.toUpperCase()}`;
      const connectionEnv = `${prefix}_${driver === "postgres" ? "URL" : "URI"}`;
      const databaseEnv = driver === "mongodb" ? `${prefix}_DATABASE` : undefined;

      if (
        !env[connectionEnv]?.trim() ||
        (databaseEnv && !env[databaseEnv]?.trim())
      ) {
        continue;
      }

      profiles.push({
        id: `storage-${driver}-${environment}`,
        name: `${driver === "postgres" ? "PostgreSQL" : "MongoDB"} · ${environment}`,
        driver,
        environment,
        configurationKey,
        connectionEnv,
        ...(databaseEnv && { databaseEnv }),
      });
    }
  }
  return profiles;
}
