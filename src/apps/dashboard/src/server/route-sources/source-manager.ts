import { databaseStorageEnabled } from "../../../../../modules/route-configuration/infrastructure/config/storage-config";
import { RouteSourceRegistry } from "../../../../../modules/route-sources/RouteSourceRegistry";
import { RouteSourceManager } from "../../../../../modules/route-sources/RouteSourceManager";
import { LocalJsonRouteConfigStore } from "../configuration/LocalJsonRouteConfigStore";
import { getRouteStorageManager } from "../../../../../modules/route-configuration/infrastructure/RouteStorageManager";

const cache = globalThis as typeof globalThis & { dashboardRouteSources?: RouteSourceManager };

export function getSourceManager(): RouteSourceManager {
  return (cache.dashboardRouteSources ??= new RouteSourceManager(
    new RouteSourceRegistry(process.env, new LocalJsonRouteConfigStore().filePath),
  ));
}
export async function getSourceStore(id: string) {
  if (id === "default") {
    return databaseStorageEnabled()
      ? getRouteStorageManager().getService()
      : new LocalJsonRouteConfigStore();
  }

  const manager = getSourceManager();
  const resolved = manager.registry.resolve(id);

  if (resolved.filePath !== undefined) {
    return new LocalJsonRouteConfigStore(resolved.filePath);
  }

  // Preserve the default manager's existing lifecycle and dependency injection contract.
  return manager.database(id).getService();
}
