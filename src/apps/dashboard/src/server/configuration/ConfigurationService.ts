import { RouteStorageError } from "../../../../../modules/route-configuration/domain/errors";
import { RouteSourceRegistry } from "../../../../../modules/route-sources/RouteSourceRegistry";
import { validateConfiguration } from "./configuration-validation";
import type { GatewayRoute, RouteConfigStore, StoredRouteConfig } from "./configuration.types";
import { getSourceStore } from "../route-sources/source-manager";

export class ConfigurationService {
  constructor(
    private readonly store?: RouteConfigStore,
    private readonly sourceId = "default",
  ) { }
  async read() {
    const store = await this.getStore();
    return this.present(await store.read());
  }
  validate(input: unknown) {
    return validateConfiguration(input);
  }
  async write(routes: GatewayRoute[], expectedRevision?: string) {
    this.requireRevision(expectedRevision);
    const store = await this.getStore();
    return this.present(await store.write(routes, expectedRevision));
  }
  async listHistory() {
    const store = await this.getStore();
    return store.listHistory?.() ?? [];
  }
  async restore(revision: string, expectedRevision?: string) {
    this.requireRevision(expectedRevision);
    const store = await this.getStore();
    if (!store.restore) throw new Error("Configuration history is not supported by this store.");
    return this.present(await store.restore(revision, expectedRevision));
  }

  private present(configuration: StoredRouteConfig) {
    return {
      ...configuration,
      sourceId: this.sourceId,
      source: new RouteSourceRegistry().list().find((source) => source.id === this.sourceId),
    };
  }

  private requireRevision(revision?: string): void {
    if (this.sourceId !== "default" && !revision)
      throw new RouteStorageError(
        "A revision precondition is required for this source.",
        "precondition",
      );
  }

  private async getStore(): Promise<RouteConfigStore> {
    if (this.store) {
      return this.store;
    }

    return getSourceStore(this.sourceId);
  }
}
