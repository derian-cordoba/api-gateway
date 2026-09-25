import { chmod, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { withErrorContext } from "@shared/errors/withErrorContext";
import { isErrorWithCode } from "@shared/errors/isErrorWithCode";
import { ConfigurationConflictError } from "../errors/ConfigurationConflictError";
import { createConfigurationRevision } from "./ConfigurationRevision";
import { validateConfiguration } from "./configuration-validation";
import type {
  ConfigurationHistoryEntry,
  GatewayRoute,
  RouteConfigStore,
  StoredRouteConfig,
} from "./configuration.types";

const EMPTY_DOCUMENT = "[]\n";
const MAX_HISTORY_ENTRIES = 50;
const writeLocks = new Map<string, Promise<void>>();

export class LocalJsonRouteConfigStore implements RouteConfigStore {
  readonly filePath: string;
  private readonly historyPath: string;

  constructor(filePath = resolveRoutesFilePath()) {
    this.filePath = filePath;
    this.historyPath = `${filePath}.history`;
  }

  async read(): Promise<StoredRouteConfig> {
    let content = EMPTY_DOCUMENT;
    let updatedAt: string | null = null;

    try {
      [content, updatedAt] = await Promise.all([
        readFile(this.filePath, "utf8"),
        stat(this.filePath).then((details) => details.mtime.toISOString()),
      ]);
    } catch (error) {
      if (!isErrorWithCode(error, "ENOENT")) throw error;
    }

    const decoded = await withErrorContext(() => JSON.parse(content) as unknown, {
      message: `Could not parse route configuration at ${this.filePath}`,
    });
    const validation = validateConfiguration(decoded);
    if (!validation.success) {
      throw new Error(
        `Stored route configuration is invalid: ${validation.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }

    return {
      routes: validation.routes,
      revision: createConfigurationRevision(content),
      updatedAt,
      filePath: this.filePath,
      warnings: validation.warnings,
    };
  }

  async write(routes: GatewayRoute[], expectedRevision?: string): Promise<StoredRouteConfig> {
    const previous = writeLocks.get(this.filePath) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    writeLocks.set(this.filePath, current);
    await previous;
    try {
      return await this.writeUnlocked(routes, expectedRevision);
    } finally {
      release();
      if (writeLocks.get(this.filePath) === current) writeLocks.delete(this.filePath);
    }
  }

  private async writeUnlocked(
    routes: GatewayRoute[],
    expectedRevision?: string,
  ): Promise<StoredRouteConfig> {
    const validation = validateConfiguration(routes);
    if (!validation.success) {
      throw new Error("Refusing to persist an invalid route configuration.");
    }

    const current = await this.read();
    if (expectedRevision !== undefined && current.revision !== expectedRevision) {
      throw new ConfigurationConflictError(expectedRevision, current.revision);
    }

    const content = `${JSON.stringify(validation.routes, null, 2)}\n`;
    const directory = dirname(this.filePath);
    const temporaryPath = resolve(directory, `.routes.${randomUUID()}.tmp`);
    await mkdir(directory, { recursive: true });

    try {
      if (current.updatedAt !== null) {
        await mkdir(this.historyPath, { recursive: true });
        await writeFile(
          resolve(this.historyPath, `${current.revision}.json`),
          `${JSON.stringify(current.routes, null, 2)}\n`,
          { encoding: "utf8", mode: 0o600 },
        );
        const historyNames = (await readdir(this.historyPath))
          .filter((name) => name.endsWith(".json"))
          .sort()
          .reverse();
        await Promise.all(
          historyNames
            .slice(MAX_HISTORY_ENTRIES)
            .map((name) => unlink(resolve(this.historyPath, name)).catch(() => undefined)),
        );
      }
      await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
      await chmod(this.filePath, 0o600);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }

    return this.read();
  }

  async listHistory(): Promise<ConfigurationHistoryEntry[]> {
    let names: string[];
    try {
      names = await readdir(this.historyPath);
    } catch (error) {
      if (isErrorWithCode(error, "ENOENT")) {
        return [];
      }
      throw error;
    }

    const entries = await Promise.all(
      names
        .filter((name) => name.endsWith(".json"))
        .map(async (name) => {
          const details = await stat(resolve(this.historyPath, name));
          return {
            revision: name.slice(0, -5),
            updatedAt: details.mtime.toISOString(),
          };
        }),
    );
    return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async restore(revision: string, expectedRevision?: string): Promise<StoredRouteConfig> {
    const content = await readFile(resolve(this.historyPath, `${revision}.json`), "utf8");
    const routes = JSON.parse(content) as GatewayRoute[];
    return this.write(routes, expectedRevision);
  }
}

function resolveRoutesFilePath(): string {
  const configuredPath = process.env.ROUTES_FILE_PATH;
  if (configuredPath) {
    return isAbsolute(configuredPath)
      ? configuredPath
      : resolve(/* turbopackIgnore: true */ process.cwd(), configuredPath);
  }

  // Dashboard scripts run with src/apps/dashboard as their working directory.
  return resolve(process.cwd(), "../../../routes.json");
}
