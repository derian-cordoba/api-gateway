import { realpathSync } from "node:fs";
import { DataSource, type EntityManager, type QueryRunner } from "typeorm";
import { RouteSchemaEntity } from "./entities";

// better-sqlite3 is synchronous: a lock wait must never block another local async transaction.
const queues = new Map<string | DataSource, Promise<unknown>>();

export class SqlUnitOfWork {
  private pending: Promise<unknown> = Promise.resolve();

  constructor(readonly source: DataSource) { }

  run<T>(
    write: boolean,
    work: (manager: EntityManager, runner: QueryRunner) => Promise<T>,
    prepare?: (runner: QueryRunner) => Promise<void>,
  ): Promise<T> {
    const execute = async () => {
      const runner = this.source.createQueryRunner();
      await runner.connect();

      try {
        // SQLite bootstrap must share the same local queue as regular transactions.
        if (prepare && this.source.options.type === "better-sqlite3") {
          await prepare(runner);
        }

        await runner.startTransaction(
          this.source.options.type === "postgres" && !write
            ? "REPEATABLE READ"
            : undefined,
        );

        if (write) {
          if (this.source.options.type === "postgres") {
            // PostgreSQL has no portable ORM API for advisory transaction locks.
            await runner.query(
              "SELECT pg_advisory_xact_lock(hashtext('gateway-route-storage'))",
            );
          } else {
            // Acquire SQLite's write reservation before reading the head, including across processes.
            await runner.manager
              .getRepository(RouteSchemaEntity)
              .createQueryBuilder()
              .update()
              .set({ version: () => "version" })
              .where("1 = 0")
              .execute();
          }
        }
        if (prepare && this.source.options.type === "postgres") {
          await prepare(runner);
        }

        const result = await work(runner.manager, runner);
        await runner.commitTransaction();

        return result;
      } catch (cause) {
        if (runner.isTransactionActive) {
          await runner.rollbackTransaction();
        }
        throw cause;
      } finally {
        await runner.release();
      }
    };
    if (this.source.options.type !== "better-sqlite3") {
      return execute();
    }

    const path = this.source.options.database;
    const key = path === ":memory:" ? this.source : realpathSync(path);
    const task = (queues.get(key) ?? Promise.resolve()).then(execute);
    const settled = task.catch(() => undefined);
    this.pending = settled;
    queues.set(key, settled);

    void settled.then(() => {
      if (queues.get(key) === settled) {
        queues.delete(key);
      }
    });

    return task;
  }

  async close(): Promise<void> {
    await this.pending;
    if (this.source.isInitialized) {
      await this.source.destroy();
    }
  }
}
