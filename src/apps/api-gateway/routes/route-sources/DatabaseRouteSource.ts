import type { RouteConfigurationRepository } from "../../../../modules/route-configuration/domain/types";
import { RouteStorageError } from "../../../../modules/route-configuration/domain/errors";
import type { JsonObject, RouteSource } from "./RouteSource";

export class DatabaseRouteSource implements RouteSource {
  loadedRevision: string | null = null;

  constructor(private readonly repository: RouteConfigurationRepository) { }

  head(): Promise<string | null> {
    return this.repository.head();
  }

  async load(): Promise<JsonObject[]> {
    const snapshot = await this.repository.read();
    if (!snapshot) {
      throw new RouteStorageError("Route database has not been initialized. Import routes before starting the gateway.", "uninitialized");
    }
    this.loadedRevision = snapshot.revision;
    return snapshot.routes as unknown as JsonObject[];
  }
}
