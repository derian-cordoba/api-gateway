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
      const cause = toError(error);
      logger.error({ err: cause }, "Failed to parse ROUTES env var as JSON");
      throw new Error("Could not parse ROUTES env var as JSON", { cause });
    }
  }
}
