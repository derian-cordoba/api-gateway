import { withErrorContext } from "../../../shared/errors/withErrorContext";
import { MongoRouteConfigurationRepository } from "./mongodb/MongoRouteConfigurationRepository";
import { SqlRouteConfigurationRepository } from "./sql/SqlRouteConfigurationRepository";
import { createRouteDataSource } from "./orm/createRouteDataSource";
import { RouteConfigurationService } from "../application/RouteConfigurationService";
import { RouteStorageError } from "../domain/errors";
import type {
  RouteConfigurationRepository,
  StorageStatus,
} from "../domain/types";
import {
  readStorageConfig,
  StorageDriver,
  type StorageConfig,
} from "./config/storage-config";
import { SafeRouteRepository } from "./SafeRouteRepository";

export class RouteStorageManager {
  private connection?: Promise<RouteConfigurationRepository>;
  private ready?: Promise<RouteConfigurationRepository>;

  constructor(readonly config: StorageConfig = readStorageConfig()) {}

  getRepository(): Promise<RouteConfigurationRepository> {
    if (!this.ready) {
      this.ready = (async () => {
        try {
          const repo = await this.connect();
          await repo.checkSchema();
          return repo;
        } catch (cause) {
          try {
            await this.close();
          } catch {
            // Keep the original initialization failure.
          }
          throw cause;
        }
      })();
    }

    return this.ready;
  }

  async getService(): Promise<RouteConfigurationService> {
    return new RouteConfigurationService(
      await this.getRepository(),
      this.getStatus(),
      this.config.historyLimit,
    );
  }

  getStatus(): StorageStatus {
    return {
      driver: this.config.driver,
      configurationKey: this.config.configurationKey,
      schemaVersion: 1,
      ...("environment" in this.config
        ? { environment: this.config.environment }
        : {}),
    };
  }

  async migrate(): Promise<void> {
    const connection = await this.connect();
    await connection.migrate();
  }

  async close(): Promise<void> {
    const current = this.connection;
    this.connection = undefined;
    this.ready = undefined;
    if (current) {
      await (await current).close();
    }
  }

  private connect(): Promise<RouteConfigurationRepository> {
    if (!this.connection) {
      this.connection = this.createRepository();
    }
    return this.connection;
  }

  private createRepository(): Promise<RouteConfigurationRepository> {
    return withErrorContext(
      async () => {
        const source = createRouteDataSource(this.config);
        await source.initialize();
        try {
          const repository =
            this.config.driver === StorageDriver.MongoDB
              ? new MongoRouteConfigurationRepository(
                  source,
                  this.config.configurationKey,
                )
              : new SqlRouteConfigurationRepository(
                  source,
                  this.config.configurationKey,
                );
          return new SafeRouteRepository(repository);
        } catch (cause) {
          await source.destroy();
          throw cause;
        }
      },
      {
        createException: (cause) =>
          new RouteStorageError(
            "Could not initialize the selected route database driver.",
            "unavailable",
            { cause },
          ),
      },
    );
  }
}

// One server-side manager per Next.js process, retained across development module reloads.
const cache = globalThis as typeof globalThis & {
  routeStorageManager?: RouteStorageManager;
};

export function getRouteStorageManager(): RouteStorageManager {
  return (cache.routeStorageManager ??= new RouteStorageManager());
}
