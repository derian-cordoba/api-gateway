import { LocalJsonRouteConfigStore } from "./LocalJsonRouteConfigStore";
import { validateConfiguration } from "./configuration-validation";
import type { GatewayRoute } from "./configuration.types";

export class ConfigurationService {
  constructor(private readonly store = new LocalJsonRouteConfigStore()) {}

  read() {
    return this.store.read();
  }

  validate(input: unknown) {
    return validateConfiguration(input);
  }

  write(routes: GatewayRoute[], expectedRevision?: string) {
    return this.store.write(routes, expectedRevision);
  }

  listHistory() {
    if (!this.store.listHistory) return Promise.resolve([]);
    return this.store.listHistory();
  }

  restore(revision: string, expectedRevision?: string) {
    if (!this.store.restore) {
      return Promise.reject(new Error("Configuration history is not supported by this store."));
    }
    return this.store.restore(revision, expectedRevision);
  }
}
