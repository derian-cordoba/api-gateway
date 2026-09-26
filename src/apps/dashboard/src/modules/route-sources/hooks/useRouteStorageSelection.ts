import type { RouteSourceSummary } from "../services/route-sources";

/** Changing a driver selects one of its configured sources; activation remains explicit. */
export function useRouteStorageSelection(
  sources: RouteSourceSummary[],
  sourceId: string,
  onSelect: (id: string) => void,
): {
  source: RouteSourceSummary | undefined;
  driver: RouteSourceSummary["driver"] | "";
  matchingSources: RouteSourceSummary[];
  selectDriver: (driver: RouteSourceSummary["driver"]) => void;
} {
  const source = sources.find((entry) => entry.id === sourceId);
  const driver = source?.driver ?? "";
  const matchingSources = sources.filter((entry) => entry.driver === driver);

  function selectDriver(nextDriver: RouteSourceSummary["driver"]) {
    if (nextDriver === driver) {
      return;
    }
    const candidates = sources.filter((entry) => entry.driver === nextDriver);

    // Prefer development for remote drivers, then the deployment default.
    const target =
      candidates.find((entry) => entry.environment === "development") ??
      candidates.find((entry) => entry.id === "default") ??
      candidates[0];

    if (target) {
      onSelect(target.id);
    }
  }
  return { source, driver, matchingSources, selectDriver };
}
