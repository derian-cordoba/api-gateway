import { isAbsolute } from "node:path";
import { RouteStorageError } from "../../domain/errors";

export enum StorageDriver {
  SQLite = "sqlite",
  PostgreSQL = "postgres",
  MongoDB = "mongodb",
}

export enum DatabaseEnvironment {
  Development = "development",
  Production = "production",
}

type Common = {
  configurationKey: string;
  historyLimit: number;
  pollIntervalMs: number;
};

export type StorageConfig = Common &
  (
    | { driver: StorageDriver.SQLite; path: string; busyTimeoutMs: number }
    | {
      driver: StorageDriver.PostgreSQL;
      environment: DatabaseEnvironment;
      url: string;
      poolSize: number;
    }
    | {
      driver: StorageDriver.MongoDB;
      environment: DatabaseEnvironment;
      uri: string;
      database: string;
      poolSize: number;
    }
  );

export function databaseStorageEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.ROUTE_STORAGE_DRIVER !== undefined &&
    env.ROUTE_STORAGE_DRIVER !== "local-json"
  );
}

export function readStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): StorageConfig {
  const required = (name: string): string => {
    const value = env[name]?.trim();
    if (!value) {
      throw new RouteStorageError(
        `${name} must be configured.`,
        "configuration",
      );
    }

    return value;
  };

  const integer = (
    name: string,
    fallback: number,
    min: number,
    max: number,
  ): number => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new RouteStorageError(
        `${name} must be between ${min} and ${max}.`,
        "configuration",
      );
    }

    return value;
  };

  const common: Common = {
    configurationKey: env.ROUTE_CONFIGURATION_KEY?.trim() || "default",
    historyLimit: integer("ROUTE_HISTORY_LIMIT", 50, 0, 10000),
    pollIntervalMs: integer("ROUTE_STORAGE_POLL_INTERVAL_MS", 2000, 100, 60000),
  };

  if (env.ROUTE_STORAGE_DRIVER === StorageDriver.SQLite) {
    const path = required("ROUTE_SQLITE_PATH");
    if (!isAbsolute(path) && path !== ":memory:") {
      throw new RouteStorageError(
        "ROUTE_SQLITE_PATH must be absolute so both applications use the same file.",
        "configuration",
      );
    }

    return {
      ...common,
      driver: StorageDriver.SQLite,
      path,
      busyTimeoutMs: 5000,
    };
  }

  if (
    env.ROUTE_STORAGE_DRIVER !== StorageDriver.PostgreSQL &&
    env.ROUTE_STORAGE_DRIVER !== StorageDriver.MongoDB
  ) {
    throw new RouteStorageError(
      "ROUTE_STORAGE_DRIVER must be sqlite, postgres, mongodb, or local-json (legacy mode).",
      "configuration",
    );
  }

  const environment = required("ROUTE_DATABASE_ENV") as DatabaseEnvironment;
  if (!Object.values(DatabaseEnvironment).includes(environment)) {
    throw new RouteStorageError(
      "ROUTE_DATABASE_ENV must be development or production.",
      "configuration",
    );
  }

  const suffix = environment.toUpperCase();
  const poolSize = integer("ROUTE_DATABASE_POOL_SIZE", 5, 1, 100);
  if (env.ROUTE_STORAGE_DRIVER === StorageDriver.PostgreSQL) {
    const url = required(`ROUTE_POSTGRES_${suffix}_URL`);
    if (!/^postgres(ql)?:\/\//.test(url)) {
      throw new RouteStorageError(
        "The PostgreSQL URL must use postgres:// or postgresql://.",
        "configuration",
      );
    }

    return {
      ...common,
      driver: StorageDriver.PostgreSQL,
      environment,
      url,
      poolSize,
    };
  }

  const uri = required(`ROUTE_MONGODB_${suffix}_URI`);
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new RouteStorageError(
      "The MongoDB URI must use mongodb:// or mongodb+srv://.",
      "configuration",
    );
  }

  return {
    ...common,
    driver: StorageDriver.MongoDB,
    environment,
    uri,
    database: required(`ROUTE_MONGODB_${suffix}_DATABASE`),
    poolSize,
  };
}
