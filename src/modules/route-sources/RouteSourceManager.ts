import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateConfiguration } from "../route-configuration/domain/validateConfiguration";
import { RouteStorageError } from "../route-configuration/domain/errors";
import { withErrorContext } from "../../shared/errors/withErrorContext";
import { RouteStorageManager } from "../route-configuration/infrastructure/RouteStorageManager";
import { RouteSourceRegistry } from "./RouteSourceRegistry";

export class RouteSourceManager {
  private readonly managers = new Map<string, RouteStorageManager>();
  constructor(readonly registry = new RouteSourceRegistry()) { }

  database(id: string): RouteStorageManager {
    const current = this.managers.get(id);
    if (current) {
      return current;
    }

    const resolved = this.registry.resolve(id);

    if (!resolved.storage) {
      throw new Error("This source uses local JSON storage.");
    }

    const manager = new RouteStorageManager(resolved.storage);
    this.managers.set(id, manager);
    return manager;
  }

  async snapshot(id: string) {
    return withErrorContext(
      async () => {
        const profile = this.registry.resolve(id);
        if (profile.storage) {
          const service = await this.database(id).getService();
          return service.read();
        }

        const content = await readFile(profile.filePath, "utf8");
        const result = validateConfiguration(JSON.parse(content));

        if (!result.success) {
          throw new RouteStorageError(
            "The source contains invalid routes.",
            "configuration",
          );
        }

        return {
          routes: result.routes,
          warnings: result.warnings,
          revision: createHash("sha256")
            .update(content)
            .digest("hex")
            .slice(0, 16),
          updatedAt: null,
        };
      },
      {
        createException: (cause) =>
          cause instanceof RouteStorageError
            ? cause
            : new RouteStorageError(
              "Could not read the route source.",
              "unavailable",
              { cause },
            ),
      },
    );
  }

  async release(id: string): Promise<void> {
    const manager = this.managers.get(id);
    this.managers.delete(id);
    await manager?.close();
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.managers.values()].map((manager) => manager.close()),
    );
    this.managers.clear();
  }
}
