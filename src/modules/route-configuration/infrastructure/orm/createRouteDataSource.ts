import "reflect-metadata";
import { chmodSync } from "node:fs";
import { DataSource } from "typeorm";
import { StorageDriver, type StorageConfig } from "../config/storage-config";
import { sqlEntities } from "./entities";
import { mongoEntities } from "./mongoEntities";

/** The only place that configures ORM connections. Schema changes remain explicit. */
export function createRouteDataSource(config: StorageConfig): DataSource {
  const common = { synchronize: false, logging: false, migrationsRun: false };
  switch (config.driver) {
    case StorageDriver.SQLite:
      return new DataSource({
        ...common,
        type: "better-sqlite3",
        database: config.path,
        entities: sqlEntities(false),
        enableWAL: true,
        timeout: config.busyTimeoutMs,
        prepareDatabase: () => {
          if (config.path !== ":memory:") {
            chmodSync(config.path, 0o600);
          }
        },
      });
    case StorageDriver.PostgreSQL:
      return new DataSource({
        ...common,
        type: "postgres",
        url: config.url,
        entities: sqlEntities(true),
        poolSize: config.poolSize,
        connectTimeoutMS: 5000,
        extra: { idleTimeoutMillis: 30000, query_timeout: 10000 },
      });
    case StorageDriver.MongoDB:
      return new DataSource({
        ...common,
        type: "mongodb",
        url: config.uri,
        database: config.database,
        entities: mongoEntities,
        extra: {
          maxPoolSize: config.poolSize,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          socketTimeoutMS: 15000,
        },
      });
  }
}
