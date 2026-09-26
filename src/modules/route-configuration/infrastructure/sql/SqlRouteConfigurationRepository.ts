import { DataSource, LessThan, Not } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity.js";
import {
  ConfigurationConflictError,
  RouteStorageError,
} from "../../domain/errors";
import type {
  ConfigurationHistoryEntry,
  RouteConfigurationRepository,
  RouteRevision,
} from "../../domain/types";
import {
  RouteHeadEntity,
  RouteImportEntity,
  RouteRevisionEntity,
} from "../orm/entities";
import { SqlSchemaMigration } from "../orm/SqlSchemaMigration";
import { SqlUnitOfWork } from "../orm/SqlUnitOfWork";

// JSON payloads are opaque values; QueryDeepPartialEntity incorrectly recurses into unknown JSON fields.
function toEntity(
  revision: RouteRevision,
  configKey: string,
): QueryDeepPartialEntity<RouteRevisionEntity> {
  return {
    ...revision,
    configKey,
  } as QueryDeepPartialEntity<RouteRevisionEntity>;
}

function toRevision(row: RouteRevisionEntity): RouteRevision {
  return {
    revision: row.revision,
    version: row.version,
    routes: row.routes,
    updatedAt: row.updatedAt,
    checksum: row.checksum,
    ...(row.restoredFrom ? { restoredFrom: row.restoredFrom } : {}),
    ...(row.legacyRevision ? { legacyRevision: row.legacyRevision } : {}),
  };
}

export class SqlRouteConfigurationRepository implements RouteConfigurationRepository {
  private readonly transactions: SqlUnitOfWork;
  private readonly schema: SqlSchemaMigration;

  constructor(
    source: DataSource,
    private readonly key: string,
  ) {
    this.transactions = new SqlUnitOfWork(source);
    this.schema = new SqlSchemaMigration(source, this.transactions);
  }

  migrate(): Promise<void> {
    return this.schema.run();
  }

  checkSchema(): Promise<void> {
    return this.transactions.run(false, (manager) =>
      this.schema.check(manager),
    );
  }

  read(): Promise<RouteRevision | null> {
    return this.transactions.run(false, async (manager) => {
      const head = await manager
        .getRepository(RouteHeadEntity)
        .findOneBy({ configKey: this.key });
      if (!head) return null;
      const row = await manager
        .getRepository(RouteRevisionEntity)
        .findOneBy({ configKey: this.key, revision: head.revision });
      return row ? toRevision(row) : null;
    });
  }

  head(): Promise<string | null> {
    return this.transactions.run(
      false,
      async (manager) =>
        (
          await manager
            .getRepository(RouteHeadEntity)
            .findOneBy({ configKey: this.key })
        )?.revision ?? null,
    );
  }

  history(limit: number, offset: number): Promise<ConfigurationHistoryEntry[]> {
    return this.transactions.run(false, async (manager) => {
      const head = await manager
        .getRepository(RouteHeadEntity)
        .findOneBy({ configKey: this.key });
      if (!head) return [];
      const rows = await manager.getRepository(RouteRevisionEntity).find({
        select: {
          revision: true,
          version: true,
          updatedAt: true,
          restoredFrom: true,
        },
        where: { configKey: this.key, revision: Not(head.revision) },
        order: { version: "DESC" },
        take: limit,
        skip: offset,
      });
      return rows.map(({ revision, version, updatedAt, restoredFrom }) => ({
        revision,
        version,
        updatedAt,
        ...(restoredFrom ? { restoredFrom } : {}),
      }));
    });
  }

  find(revision: string): Promise<RouteRevision | null> {
    return this.transactions.run(false, async (manager) => {
      const row = await manager
        .getRepository(RouteRevisionEntity)
        .findOneBy({ configKey: this.key, revision });
      return row ? toRevision(row) : null;
    });
  }

  commit(
    revision: RouteRevision,
    expectedRevision: string,
    historyLimit: number,
  ): Promise<RouteRevision> {
    return this.transactions.run(true, async (manager) => {
      const heads = manager.getRepository(RouteHeadEntity);
      const revisions = manager.getRepository(RouteRevisionEntity);
      const head = await heads.findOneBy({ configKey: this.key });

      if (!head || head.revision !== expectedRevision) {
        throw new ConfigurationConflictError(
          expectedRevision,
          head?.revision ?? "",
        );
      }
      const saved = { ...revision, version: head.version + 1 };

      await revisions.insert(toEntity(saved, this.key));

      const changed = await heads.update(
        { configKey: this.key, revision: expectedRevision },
        { revision: saved.revision, version: saved.version },
      );

      if (changed.affected !== 1) {
        throw new ConfigurationConflictError(expectedRevision, head.revision);
      }

      await revisions.delete({
        configKey: this.key,
        version: LessThan(saved.version - historyLimit),
      });
      return saved;
    });
  }

  initialize(revisions: RouteRevision[], importId: string): Promise<void> {
    return this.transactions.run(true, async (manager) => {
      if (!revisions.length) {
        throw new RouteStorageError(
          "Initialization requires a snapshot.",
          "configuration",
        );
      }

      const imports = manager.getRepository(RouteImportEntity);

      if (await imports.existsBy({ configKey: this.key, importId })) {
        return;
      }

      const heads = manager.getRepository(RouteHeadEntity);
      if (await heads.existsBy({ configKey: this.key })) {
        throw new RouteStorageError(
          "Refusing to import over an existing configuration.",
          "configuration",
        );
      }

      // Individual inserts avoid SQLite's parameter limit on large legacy history imports.
      for (const [index, revision] of revisions.entries()) {
        await manager
          .getRepository(RouteRevisionEntity)
          .insert(toEntity({ ...revision, version: index + 1 }, this.key));
      }

      await heads.insert({
        configKey: this.key,
        revision: revisions[revisions.length - 1].revision,
        version: revisions.length,
      });

      await imports.insert({ configKey: this.key, importId });
    });
  }

  close(): Promise<void> {
    return this.transactions.close();
  }
}
