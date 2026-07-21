import { logger } from "../../logger";
import type { JsonObject, RouteSource } from "./RouteSource";

export class EnvRouteSource implements RouteSource {
  async load(): Promise<JsonObject[]> {
    const raw = process.env.ROUTES;
    if (!raw) return [];

    try {
      return JSON.parse(raw) as JsonObject[];
    } catch (error) {
      logger.error({ err: error }, "Failed to parse ROUTES env var as JSON, skipping");
      return [];
    }
  }
}
