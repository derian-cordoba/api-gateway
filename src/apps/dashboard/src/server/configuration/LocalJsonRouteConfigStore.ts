import { chmod, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { withErrorContext } from "@shared/errors/withErrorContext";
import { isErrorWithCode } from "@shared/errors/isErrorWithCode";
import { ConfigurationConflictError } from "../errors/ConfigurationConflictError";
import { createConfigurationRevision } from "./ConfigurationRevision";
import { validateConfiguration } from "./configuration-validation";
import type { GatewayRoute, RouteConfigStore, StoredRouteConfig } from "./configuration.types";

const EMPTY_DOCUMENT = "[]\n";

export class LocalJsonRouteConfigStore implements RouteConfigStore {
  readonly filePath: string;

  constructor(filePath = resolveRoutesFilePath()) {
    this.filePath = filePath;
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
      await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.filePath);
      await chmod(this.filePath, 0o600);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }

    return this.read();
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
