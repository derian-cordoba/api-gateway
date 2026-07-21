import { readFile } from "node:fs/promises";
import { logger } from "../../logger";
import type { JsonObject, RouteSource } from "./RouteSource";

export class FileRouteSource implements RouteSource {
  constructor(private readonly filePath: string) {}

  async load(): Promise<JsonObject[]> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return JSON.parse(content) as JsonObject[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.debug({ filePath: this.filePath }, "Routes file not found, skipping");
        return [];
      }
      // Re-throw so RouteReloader can catch and keep the last good config.
      throw error;
    }
  }
}
