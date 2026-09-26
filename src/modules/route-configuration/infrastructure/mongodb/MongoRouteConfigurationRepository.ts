import type { DataSource, MongoRepository } from "typeorm";
import { MongoUnitOfWork } from "../orm/MongoUnitOfWork";
import { MongoDocuments } from "../orm/MongoDocuments";
import {
  ConfigurationConflictError,
  RouteStorageError,
} from "../../domain/errors";
import type {
  ConfigurationHistoryEntry,
  RouteConfigurationRepository,
  RouteRevision,
} from "../../domain/types";

import type {
  MongoHead as Head,
  MongoSnapshot as Snapshot,
  MongoSchema as Migration,
  MongoImport as Receipt,
} from "../orm/mongoEntities";

export class MongoRouteConfigurationRepository implements RouteConfigurationRepository {
  private readonly heads: MongoRepository<Head>;
  private readonly revisions: MongoRepository<Snapshot>;
  private readonly schema: MongoRepository<Migration>;
  private readonly imports: MongoRepository<Receipt>;
  private readonly transactions: MongoUnitOfWork;

  constructor(
    private readonly source: DataSource,
    private readonly key: string,
  ) {
    this.transactions = new MongoUnitOfWork(source);
    this.heads = source.getMongoRepository<Head>("route_heads");
    this.revisions = source.getMongoRepository<Snapshot>("route_revisions");
    this.schema = source.getMongoRepository<Migration>("route_storage_schema");
    this.imports = source.getMongoRepository<Receipt>("route_imports");
  }

  async migrate(): Promise<void> {
    await this.transactions.checkTopology();
    const existing = await new MongoDocuments(this.schema).one({
      _id: "schema",
    });

    if (existing) {
      this.validateSchema(existing);
      return;
    }

    // Index operations are idempotent; publish schema version only after all indexes exist.
    await this.revisions.createCollectionIndex(
      { configKey: 1, revision: 1 },
      { unique: true },
    );

    await this.revisions.createCollectionIndex(
      { configKey: 1, version: -1 },
      { unique: true },
    );

    await this.imports.createCollectionIndex(
      { configKey: 1, importId: 1 },
      { unique: true },
    );

    await this.schema.updateOne(
      { _id: "schema" },
      { $setOnInsert: { version: 1, checksum: "route-storage-v1-snapshots" } },
      { upsert: true },
    );

    await this.checkSchema();
  }

  async checkSchema(): Promise<void> {
    await this.transactions.checkTopology();
    this.validateSchema(
      await new MongoDocuments(this.schema).one({ _id: "schema" }),
    );
  }

  async read(): Promise<RouteRevision | null> {
    // A snapshot transaction prevents retention racing the head/revision read.
    return this.transactions.run(async (session) => {
      const head = await new MongoDocuments(this.heads).one(
        { _id: this.key },
        { session },
      );

      return head
        ? new MongoDocuments(this.revisions).one(
          { configKey: this.key, revision: head.revision },
          { session, projection: { _id: 0, configKey: 0 } },
        )
        : null;
    });
  }

  async head(): Promise<string | null> {
    const head = await new MongoDocuments(this.heads).one({ _id: this.key });
    return head?.revision ?? null;
  }

  async history(
    limit: number,
    offset: number,
  ): Promise<ConfigurationHistoryEntry[]> {
    return this.transactions.run(async (session) => {
      const head = await new MongoDocuments(this.heads).one(
        { _id: this.key },
        { session },
      );

      if (!head) {
        return [];
      }

      return this.revisions
        .aggregate<ConfigurationHistoryEntry>(
          [
            {
              $match: { configKey: this.key, revision: { $ne: head.revision } },
            },
            { $sort: { version: -1 } },
            { $skip: offset },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                revision: 1,
                version: 1,
                updatedAt: 1,
                restoredFrom: 1,
              },
            },
          ],
          { session },
        )
        .toArray();
    });
  }

  async find(revision: string): Promise<RouteRevision | null> {
    return new MongoDocuments(this.revisions).one(
      { configKey: this.key, revision },
      { projection: { _id: 0, configKey: 0 } },
    );
  }

  async commit(
    revision: RouteRevision,
    expectedRevision: string,
    historyLimit: number,
  ): Promise<RouteRevision> {
    return this.transactions.run(async (session) => {
      const head = await new MongoDocuments(this.heads).one(
        { _id: this.key },
        { session },
      );

      if (!head || head.revision !== expectedRevision) {
        throw new ConfigurationConflictError(
          expectedRevision,
          head?.revision ?? "",
        );
      }

      const saved = { ...revision, version: head.version + 1 };
      const result = await this.heads.updateOne(
        { _id: this.key, revision: expectedRevision },
        { $set: { revision: saved.revision, version: saved.version } },
        { session },
      );

      if (result.matchedCount !== 1) {
        throw new ConfigurationConflictError(expectedRevision, head.revision);
      }

      await this.revisions.insertOne(
        { ...saved, configKey: this.key },
        { session },
      );

      await this.revisions.deleteMany(
        { configKey: this.key, version: { $lt: saved.version - historyLimit } },
        { session },
      );

      return saved;
    });
  }

  async initialize(
    revisions: RouteRevision[],
    importId: string,
  ): Promise<void> {
    if (!revisions.length) {
      throw new RouteStorageError(
        "Initialization requires a snapshot.",
        "configuration",
      );
    }

    await this.transactions.run(async (session) => {
      if (
        await new MongoDocuments(this.imports).one(
          { configKey: this.key, importId },
          { session },
        )
      ) {
        return;
      }

      if (
        await new MongoDocuments(this.heads).one({ _id: this.key }, { session })
      ) {
        throw new RouteStorageError(
          "Refusing to import over an existing configuration.",
          "configuration",
        );
      }

      await this.heads.insertOne(
        {
          _id: this.key,
          revision: revisions[revisions.length - 1].revision,
          version: revisions.length,
        },
        { session },
      );

      await this.revisions.insertMany(
        revisions.map((r, index) => ({
          ...r,
          configKey: this.key,
          version: index + 1,
        })),
        { session },
      );

      await this.imports.insertOne(
        { configKey: this.key, importId },
        { session },
      );
    });
  }

  close(): Promise<void> {
    return this.source.destroy();
  }

  private validateSchema(value: Migration | null): void {
    if (value?.version !== 1 || value.checksum !== "route-storage-v1-snapshots") {
      throw new RouteStorageError(
        "Route storage schema is incompatible. Run routes:db:migrate.",
        "schema",
      );
    }
  }
}
