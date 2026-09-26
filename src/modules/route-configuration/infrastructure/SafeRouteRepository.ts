import type {
  RouteConfigurationRepository,
  RouteRevision,
} from "../domain/types";
import { withErrorContext } from "../../../shared/errors/withErrorContext";
import {
  ConfigurationConflictError,
  RouteStorageError,
} from "../domain/errors";

/** 
 * Driver error messages may contain hosts/credentials; retain them only in the cause chain.
*/
export class SafeRouteRepository implements RouteConfigurationRepository {
  constructor(private readonly inner: RouteConfigurationRepository) { }

  migrate() {
    return this.run(() => this.inner.migrate());
  }

  checkSchema() {
    return this.run(() => this.inner.checkSchema(), "schema");
  }

  read() {
    return this.run(() => this.inner.read());
  }

  head() {
    return this.run(() => this.inner.head());
  }

  history(limit: number, offset: number) {
    return this.run(() => this.inner.history(limit, offset));
  }

  find(revision: string) {
    return this.run(() => this.inner.find(revision));
  }

  commit(
    revision: RouteRevision,
    expectedRevision: string,
    historyLimit: number,
  ) {
    return this.run(() =>
      this.inner.commit(revision, expectedRevision, historyLimit),
    );
  }

  initialize(revisions: RouteRevision[], importId: string) {
    return this.run(() => this.inner.initialize(revisions, importId));
  }

  close() {
    return this.run(() => this.inner.close());
  }

  private run<T>(
    operation: () => Promise<T>,
    code: "schema" | "unavailable" = "unavailable",
  ): Promise<T> {
    return withErrorContext(operation, {
      createException: (cause) =>
        cause instanceof RouteStorageError || cause instanceof ConfigurationConflictError
          ? cause
          : new RouteStorageError(
            code === "schema"
              ? "Could not verify route storage schema. Check connectivity and run routes:db:migrate."
              : "Route database operation failed.",
            code,
            { cause },
          ),
    });
  }
}
