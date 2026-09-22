import { logger } from "../../logger";
import { toError } from "../../../../shared/errors/toError";
import type { JsonObject, RouteSource } from "./RouteSource";

export class EnvRouteSource implements RouteSource {
  async load(): Promise<JsonObject[]> {
    const raw = process.env.ROUTES;
    if (!raw) return [];

    try {
      return JSON.parse(raw) as JsonObject[];
    } catch (error) {
      logger.error({ err: toError(error) }, "Failed to parse ROUTES env var as JSON, skipping");
      return [];
    }
  }
}
