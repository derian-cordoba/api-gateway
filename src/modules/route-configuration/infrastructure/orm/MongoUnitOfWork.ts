import type { DataSource } from "typeorm";
import type { MongoClient } from "mongodb";
import type { ClientSession } from "typeorm/driver/mongodb/typings.js";
import type { MongoQueryRunner } from "typeorm/driver/mongodb/MongoQueryRunner.js";
import { RouteStorageError } from "../../domain/errors";

/** TypeORM Mongo transactions are no-ops. Bridge its owned client to real driver sessions. */
export class MongoUnitOfWork {
  private readonly client: MongoClient;

  constructor(source: DataSource) {
    const runner = source.createQueryRunner() as MongoQueryRunner;
    // TypeORM bundles an older copy of the driver types; the runtime client is mongodb v6.
    this.client = runner.databaseConnection as unknown as MongoClient;
  }

  async checkTopology(): Promise<void> {
    const hello = await this.client.db("admin").command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") {
      throw new RouteStorageError(
        "MongoDB route storage requires a replica set or sharded cluster for transactions.",
        "configuration",
      );
    }
  }

  async run<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      return await session.withTransaction(
        () => work(session as unknown as ClientSession),
        {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          maxCommitTimeMS: 10000,
          timeoutMS: 15000,
        },
      );
    } finally {
      await session.endSession();
    }
  }
}
