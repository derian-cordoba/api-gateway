import { readFile } from "node:fs/promises";
import { withErrorContext } from "../../../../shared/errors/withErrorContext";
import { isErrorWithCode } from "../../../../shared/errors/isErrorWithCode";
import { logger } from "../../logger";
import type { JsonObject, RouteSource } from "./RouteSource";

export class FileRouteSource implements RouteSource {
  constructor(private readonly filePath: string) {}

  async load(): Promise<JsonObject[]> {
    return withErrorContext(
      async () => {
        try {
          const content = await readFile(this.filePath, "utf-8");
          return JSON.parse(content) as JsonObject[];
        } catch (error) {
          if (isErrorWithCode(error, "ENOENT")) {
            logger.debug(
              { filePath: this.filePath },
              "Routes file not found, skipping",
            );
            return [];
          }
          throw error;
        }
      },
      { message: `Could not load routes from ${this.filePath}` },
    );
  }
}
