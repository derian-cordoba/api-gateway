import {
  configuredStorageProfiles,
  RESERVED_STORAGE_SOURCE_ID,
  type ConnectionProfile,
} from "./configuredStorageProfiles";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import {
  readStorageConfig,
  databaseStorageEnabled,
  type StorageConfig,
} from "../route-configuration/infrastructure/config/storage-config";
import { RouteStorageError } from "../route-configuration/domain/errors";
import type { RouteSourceSummary } from "./types";

const profileSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    name: z.string().min(1).max(80),
    driver: z.enum(["local-json", "sqlite", "postgres", "mongodb"]),
    environment: z.enum(["development", "production"]).optional(),
    configurationKey: z.string().min(1).max(128).default("default"),
    connectionEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    databaseEnv: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .optional(),
  })
  .strict();

export type ResolvedRouteSource = { summary: RouteSourceSummary } & (
  | { filePath: string; storage?: never }
  | { storage: StorageConfig; filePath?: never }
);

/** Profiles contain secret references. Only summaries may cross the server boundary. */
export class RouteSourceRegistry {
  private readonly profiles: ConnectionProfile[];
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly defaultFilePath = resolve(
      /* turbopackIgnore: true */
      env.ROUTES_FILE_PATH || "routes.json",
    ),
  ) {
    try {
      this.profiles = z
        .array(profileSchema)
        .max(50)
        .parse(JSON.parse(env.ROUTE_SOURCE_PROFILES || "[]"));

      const ids = this.profiles.map((profile) => profile.id);

      if (
        ids.includes("default") ||
        ids.some((id) => RESERVED_STORAGE_SOURCE_ID.test(id)) ||
        new Set(ids).size !== ids.length
      ) {
        throw new Error("Duplicate or reserved source ID");
      }

      for (const profile of this.profiles) {
        if (
          ["postgres", "mongodb"].includes(profile.driver) !==
          !!profile.environment
        ) {
          throw new Error("Invalid source environment");
        }
      }
      this.profiles.push(...configuredStorageProfiles(env));
    } catch {
      throw new RouteStorageError(
        "ROUTE_SOURCE_PROFILES must contain unique, valid source profiles; default is reserved, as are built-in storage IDs. Remote profiles require an environment; local profiles cannot have one.",
        "configuration",
      );
    }
  }

  list(): RouteSourceSummary[] {
    const defaultDriver = this.env.ROUTE_STORAGE_DRIVER || "local-json";
    return [
      {
        id: "default",
        name: "Default source",
        driver: defaultDriver as RouteSourceSummary["driver"],
        configurationKey: this.env.ROUTE_CONFIGURATION_KEY || "default",
        ...(["postgres", "mongodb"].includes(defaultDriver)
          ? {
            environment: this.env
              .ROUTE_DATABASE_ENV as RouteSourceSummary["environment"],
          }
          : {}),
      },
      ...(defaultDriver !== "local-json"
        ? [
          {
            id: "storage-json",
            name: "Legacy JSON file",
            driver: "local-json" as const,
            configurationKey: this.env.ROUTE_CONFIGURATION_KEY || "default",
          },
        ]
        : []),
      ...this.profiles.map(
        ({ id, name, driver, environment, configurationKey }) => ({
          id,
          name,
          driver,
          environment,
          configurationKey,
        }),
      ),
    ];
  }

  resolve(id: string): ResolvedRouteSource {
    const summary = this.list().find((entry) => entry.id === id);
    if (!summary) {
      throw new RouteStorageError("Unknown route source.", "not-found");
    }

    if (id === "storage-json")
      return { summary, filePath: this.defaultFilePath };

    if (id === "default") {
      return databaseStorageEnabled(this.env)
        ? { summary, storage: readStorageConfig(this.env) }
        : { summary, filePath: this.defaultFilePath };
    }

    const profile = this.profiles.find((entry) => entry.id === id)!;
    const connection = this.env[profile.connectionEnv]?.trim();

    if (!connection) {
      throw new RouteStorageError(
        "The route source connection is not configured.",
        "configuration",
      );
    }

    if (profile.driver === "local-json") {
      if (!isAbsolute(connection)) {
        throw new RouteStorageError(
          "Route source file paths must be absolute.",
          "configuration",
        );
      }

      return { summary, filePath: connection };
    }

    const suffix = profile.environment?.toUpperCase();

    return {
      summary,
      storage: readStorageConfig({
        NODE_ENV: this.env.NODE_ENV,
        ROUTE_STORAGE_DRIVER: profile.driver,
        ROUTE_CONFIGURATION_KEY: profile.configurationKey,
        ROUTE_HISTORY_LIMIT: this.env.ROUTE_HISTORY_LIMIT,
        ROUTE_STORAGE_POLL_INTERVAL_MS: this.env.ROUTE_STORAGE_POLL_INTERVAL_MS,
        ROUTE_DATABASE_POOL_SIZE: this.env.ROUTE_DATABASE_POOL_SIZE,
        ROUTE_DATABASE_ENV: profile.environment,
        ROUTE_SQLITE_PATH: connection,
        [`ROUTE_POSTGRES_${suffix}_URL`]: connection,
        [`ROUTE_MONGODB_${suffix}_URI`]: connection,
        [`ROUTE_MONGODB_${suffix}_DATABASE`]: profile.databaseEnv
          ? this.env[profile.databaseEnv]
          : undefined,
      }),
    };
  }
}
