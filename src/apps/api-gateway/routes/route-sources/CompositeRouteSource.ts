import type { JsonObject, RouteSource } from "./RouteSource";

/**
 * Loads routes from multiple sources in parallel and merges the results.
 * File routes and env-var routes are fetched concurrently; the merged array
 * preserves the order of sources passed to the constructor.
 */
export class CompositeRouteSource implements RouteSource {
  constructor(private readonly sources: RouteSource[]) {}

  async load(): Promise<JsonObject[]> {
    const results = await Promise.all(this.sources.map((source) => source.load()));
    return results.flat();
  }
}
