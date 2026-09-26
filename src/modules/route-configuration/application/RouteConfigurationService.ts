import { createRevision } from "../domain/revision";
import { RouteStorageError } from "../domain/errors";
import { validateConfiguration } from "../domain/validateConfiguration";
import type {
  GatewayRoute,
  RouteConfigurationRepository,
  StoredRouteConfig,
  RouteRevision,
  StorageStatus,
} from "../domain/types";

export class RouteConfigurationService {
  constructor(
    private readonly repository: RouteConfigurationRepository,
    private readonly status: StorageStatus,
    private readonly historyLimit = 50,
  ) { }

  async read(): Promise<StoredRouteConfig> {
    const revision = await this.repository.read();
    if (!revision)
      throw new RouteStorageError(
        "Route storage is empty. Import routes or explicitly initialize an empty configuration.",
        "uninitialized",
      );
    return this.present(revision);
  }

  async write(
    routes: GatewayRoute[],
    expectedRevision?: string,
  ): Promise<StoredRouteConfig> {
    return this.save(routes, expectedRevision);
  }

  listHistory(limit = 50, offset = 0) {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 10000 ||
      !Number.isInteger(offset) ||
      offset < 0
    )
      throw new RouteStorageError(
        "Invalid history pagination.",
        "configuration",
      );
    return this.repository.history(limit, offset);
  }

  async restore(
    revision: string,
    expectedRevision?: string,
  ): Promise<StoredRouteConfig> {
    const snapshot = await this.repository.find(revision);
    if (!snapshot)
      throw new RouteStorageError(
        "The requested revision was not found.",
        "not-found",
      );
    return this.save(snapshot.routes, expectedRevision, revision);
  }

  private async save(
    input: GatewayRoute[],
    expectedRevision?: string,
    restoredFrom?: string,
  ) {
    if (!expectedRevision) {
      throw new RouteStorageError(
        "expectedRevision is required when updating database configuration.",
        "precondition",
      );
    }

    const validation = validateConfiguration(input);

    if (!validation.success) {
      throw new RouteStorageError(
        "Refusing to persist an invalid route configuration.",
        "configuration",
      );
    }

    return this.present(
      await this.repository.commit(
        createRevision(validation.routes, restoredFrom),
        expectedRevision,
        this.historyLimit,
      ),
    );
  }

  private present(revision: RouteRevision): StoredRouteConfig {
    const validation = validateConfiguration(revision.routes);
    if (!validation.success) {
      throw new RouteStorageError(
        "Stored route configuration failed validation.",
        "configuration",
      );
    }

    return {
      routes: validation.routes,
      revision: revision.revision,
      updatedAt: revision.updatedAt,
      warnings: validation.warnings,
      storage: this.status,
    };
  }
}
