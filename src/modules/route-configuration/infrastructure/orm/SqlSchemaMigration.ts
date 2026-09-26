import {
  Table,
  type DataSource,
  type QueryRunner,
  type EntityManager,
} from "typeorm";
import { RouteStorageError } from "../../domain/errors";
import { RouteSchemaEntity } from "./entities";
import { SqlUnitOfWork } from "./SqlUnitOfWork";

const SCHEMA_VERSION = 1;
// Retain version-one checksums so existing databases can be opened without rewriting their data.
const CHECKSUMS = {
  postgres: "2d2f22bc72e9869d519e9a75cd64f1d1b46075f779f0a86830fa5efb1e411d71",
  sqlite: "382c8771af5c4113f634b10e44e48c12220fd1e6537121b8eecc04d7b8729ed7",
};

export class SqlSchemaMigration {
  constructor(
    private readonly source: DataSource,
    private readonly transactions: SqlUnitOfWork,
  ) {}

  async check(manager: EntityManager): Promise<void> {
    this.validate(
      await manager.getRepository(RouteSchemaEntity).findOneBy({ id: 1 }),
    );
  }

  async run(): Promise<void> {
    await this.transactions.run(
      true,
      async (manager, transaction) => {
        const schema = manager.getRepository(RouteSchemaEntity);
        const existing = await schema.findOneBy({ id: 1 });
        if (existing) {
          this.validate(existing);
          return;
        }
        const key = { name: "config_key", type: "text", isPrimary: true };
        await transaction.createTable(
          new Table({
            name: "route_heads",
            columns: [
              key,
              { name: "revision", type: "text" },
              { name: "version", type: "bigint" },
            ],
          }),
        );
        await transaction.createTable(
          new Table({
            name: "route_revisions",
            columns: [
              key,
              { name: "revision", type: "text", isPrimary: true },
              { name: "version", type: "bigint" },
              {
                name: "payload",
                type:
                  this.source.options.type === "postgres" ? "jsonb" : "text",
              },
              { name: "updated_at", type: "text" },
              { name: "checksum", type: "text" },
              { name: "restored_from", type: "text", isNullable: true },
              { name: "legacy_revision", type: "text", isNullable: true },
            ],
            uniques: [{ columnNames: ["config_key", "version"] }],
          }),
        );
        await transaction.createTable(
          new Table({
            name: "route_imports",
            columns: [
              key,
              { name: "import_id", type: "text", isPrimary: true },
            ],
          }),
        );
        await schema.insert({
          id: 1,
          version: SCHEMA_VERSION,
          checksum: this.checksum,
        });
      },
      (runner) => this.createVersionTable(runner),
    );
  }

  private async createVersionTable(runner: QueryRunner): Promise<void> {
    await runner.createTable(
      new Table({
        name: "route_storage_schema",
        columns: [
          { name: "id", type: "integer", isPrimary: true },
          { name: "version", type: "integer" },
          { name: "checksum", type: "text" },
        ],
      }),
      true,
    );
  }

  private get checksum(): string {
    return this.source.options.type === "postgres"
      ? CHECKSUMS.postgres
      : CHECKSUMS.sqlite;
  }

  private validate(schema: RouteSchemaEntity | null): void {
    if (
      schema?.version !== SCHEMA_VERSION ||
      schema.checksum !== this.checksum
    ) {
      throw new RouteStorageError(
        "Route storage schema is incompatible. Run routes:db:migrate with the matching application version.",
        "schema",
      );
    }
  }
}
