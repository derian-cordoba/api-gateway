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
}
