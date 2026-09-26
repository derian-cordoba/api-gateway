import { withErrorContext } from "../../../../shared/errors/withErrorContext";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { isErrorWithCode } from "../../../../shared/errors/isErrorWithCode";
import { validateConfiguration } from "../../domain/validateConfiguration";
import { checksum, createRevision } from "../../domain/revision";
import { RouteStorageError } from "../../domain/errors";
import type { RouteRevision } from "../../domain/types";

export class JsonConfigurationImporter {
  async prepare(
    file: string,
    historyDirectory = `${file}.history`,
  ): Promise<{ revisions: RouteRevision[]; importId: string }> {
    let names: string[] = [];
    try {
      names = await readdir(historyDirectory);
    } catch (error) {
      if (!isErrorWithCode(error, "ENOENT")) {
        throw error;
      }
    }

    const revisions = await Promise.all(
      names
        .filter((name) => /^[a-f0-9]{16}\.json$/.test(name))
        .map((name) =>
          this.read(join(historyDirectory, name), name.slice(0, -5)),
        ),
    );

    revisions.sort(
      (a, b) =>
        a.updatedAt.localeCompare(b.updatedAt) ||
        (a.legacyRevision ?? "").localeCompare(b.legacyRevision ?? ""),
    );

    // The current file is authoritative, regardless of historical file mtimes.
    revisions.push(await this.read(file));

    const importId = checksum(
      revisions.map((r) => ({
        checksum: r.checksum,
        legacyRevision: r.legacyRevision,
        updatedAt: r.updatedAt,
      })),
    );

    return { revisions, importId };
  }

  private async read(
    path: string,
    legacyRevision?: string,
  ): Promise<RouteRevision> {
    const [content, details] = await Promise.all([
      readFile(path, "utf8"),
      stat(path),
    ]);

    const decoded = await withErrorContext(
      () => JSON.parse(content) as unknown,
      { message: `Could not parse route import at ${path}` },
    );

    const validation = validateConfiguration(decoded);
    if (!validation.success) {
      throw new RouteStorageError(
        `Invalid routes in import file: ${path}`,
        "configuration",
      );
    }

    return {
      ...createRevision(validation.routes),
      updatedAt: details.mtime.toISOString(),
      legacyRevision:
        legacyRevision ??
        createHash("sha256").update(content).digest("hex").slice(0, 16),
    };
  }
}
