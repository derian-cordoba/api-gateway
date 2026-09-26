import "reflect-metadata";
import { chmodSync } from "node:fs";
import { isAbsolute } from "node:path";
import { DataSource, EntitySchema, Table } from "typeorm";
import {
  ConfigurationConflictError,
  RouteStorageError,
} from "../route-configuration/domain/errors";
import type { SourceSelection } from "./types";

class SelectionEntity {
  id!: number;
  sourceId!: string;
  version!: number;
}

const entity = new EntitySchema<SelectionEntity>({
  name: "SourceSelection",
  target: SelectionEntity,
  tableName: "route_source_selection",
  columns: {
    id: { type: "integer", primary: true },
    sourceId: { type: "text", name: "source_id" },
    version: { type: "integer" },
  },
});

/** Stable control storage, independent of all selectable route databases. */
export class SourceSelectionStore {
  private source?: DataSource;
  private ready?: Promise<void>;
  readonly enabled: boolean;
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.enabled = !!(
      env.ROUTE_CONTROL_SQLITE_PATH || env.ROUTE_CONTROL_POSTGRES_URL
    );
  }

  async read(): Promise<SourceSelection> {
    if (!this.enabled) {
      return { sourceId: "default", version: 0 };
    }
    await this.connect();

    const row = await this.source!.getRepository(
      SelectionEntity,
    ).findOneByOrFail({ id: 1 });

    return { sourceId: row.sourceId, version: row.version };
  }

  async select(
    sourceId: string,
    expectedVersion: number,
  ): Promise<SourceSelection> {
    if (!this.enabled) {
      throw new RouteStorageError(
        "Configure a route control database to enable activation.",
        "configuration",
      );
    }

    await this.connect();

    const changed = await this.source!.getRepository(SelectionEntity).update(
      { id: 1, version: expectedVersion },
      { sourceId, version: expectedVersion + 1 },
    );

    if (changed.affected !== 1) {
      throw new ConfigurationConflictError(
        String(expectedVersion),
        String((await this.read()).version),
      );
    }

    return { sourceId, version: expectedVersion + 1 };
  }
  async close(): Promise<void> {
    if (this.ready) {
      await this.ready;
    }

    if (this.source?.isInitialized) {
      await this.source.destroy();
    }

    this.source = undefined;
    this.ready = undefined;
  }
  private connect(): Promise<void> {
    return (this.ready ??= this.initialize().catch(async (cause) => {
      if (this.source?.isInitialized) {
        await this.source.destroy();
      }

      this.ready = undefined;

      throw new RouteStorageError(
        "Could not open the route control database.",
        "unavailable",
        { cause },
      );
    }));
  }
  private async initialize(): Promise<void> {
    const path = this.env.ROUTE_CONTROL_SQLITE_PATH;
    const url = this.env.ROUTE_CONTROL_POSTGRES_URL;

    if (!!path === !!url || (path && !isAbsolute(path))) {
      throw new Error(
        "Configure exactly one control database with an absolute SQLite path or PostgreSQL URL.",
      );
    }

    const common = { entities: [entity], synchronize: false, logging: false };

    this.source = new DataSource(
      url
        ? {
          ...common,
          type: "postgres",
          url,
          poolSize: 2,
          connectTimeoutMS: 5000,
        }
        : {
          ...common,
          type: "better-sqlite3",
          database: path!,
          enableWAL: true,
          timeout: 5000,
          prepareDatabase: () => chmodSync(path!, 0o600),
        },
    );

    await this.source.initialize();

    const runner = this.source.createQueryRunner();

    try {
      if (url) {
        await runner.startTransaction();
        await runner.query(
          "SELECT pg_advisory_xact_lock(hashtext('gateway-route-control-schema'))",
        );
      }
      try {
        await runner.createTable(
          new Table({
            name: "route_source_selection",
            columns: [
              { name: "id", type: "integer", isPrimary: true },
              { name: "source_id", type: "text" },
              { name: "version", type: "integer" },
            ],
          }),
          true,
        );
      } catch (cause) {
        if (url || !(await runner.hasTable("route_source_selection"))) {
          throw cause;
        }
      }

      await runner.manager
        .createQueryBuilder()
        .insert()
        .into(SelectionEntity)
        .values({ id: 1, sourceId: "default", version: 0 })
        .orIgnore()
        .execute();

      if (runner.isTransactionActive) {
        await runner.commitTransaction();
      }
    } catch (cause) {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction();
      }
      throw cause;
    } finally {
      await runner.release();
    }
  }
}
