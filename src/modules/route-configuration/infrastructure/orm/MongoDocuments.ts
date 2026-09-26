import type { MongoRepository, ObjectLiteral } from "typeorm";
import type { ClientSession } from "typeorm/driver/mongodb/typings.js";

/** Session-aware reads: TypeORM's find helpers do not forward transaction sessions. */
export class MongoDocuments<T extends ObjectLiteral> {
  constructor(readonly repository: MongoRepository<T>) { }

  async one(
    filter: ObjectLiteral,
    options: { session?: ClientSession; projection?: ObjectLiteral } = {},
  ): Promise<T | null> {
    const pipeline = [
      { $match: filter },
      { $limit: 1 },
      ...(options.projection ? [{ $project: options.projection }] : []),
    ];
    const [rows] = await this.repository
      .aggregate<T>(pipeline, { session: options.session })
      .toArray();

    return rows ?? null;
  }
}
