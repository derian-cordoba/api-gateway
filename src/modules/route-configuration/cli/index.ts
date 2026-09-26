import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { RouteStorageManager } from "../infrastructure/RouteStorageManager";
import { StorageDriver } from "../infrastructure/config/storage-config";
import { JsonConfigurationImporter } from "../infrastructure/legacy/JsonConfigurationImporter";
import { createRevision } from "../domain/revision";

async function main(): Promise<void> {
  const command = process.argv[2];
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      file: { type: "string" },
      history: { type: "string" },
      out: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      empty: { type: "boolean", default: false },
    },
  });

  if (!["migrate", "status", "import-json", "export-json"].includes(command)) {
    throw new Error("Use migrate, status, import-json, or export-json.");
  }

  const manager = new RouteStorageManager();

  try {
    if (command === "migrate") {
      if (
        manager.config.driver === StorageDriver.SQLite &&
        manager.config.path !== ":memory:"
      )
        await mkdir(dirname(manager.config.path), {
          recursive: true,
          mode: 0o700,
        });
      await manager.migrate();
      console.log(JSON.stringify({ migrated: true, ...manager.getStatus() }));
    } else if (command === "import-json") {
      if ((!values.file && !values.empty) || (values.file && values.empty))
        throw new Error("Choose --file <routes.json> or --empty explicitly.");
      const prepared = values.empty
        ? {
          revisions: [createRevision([])],
          importId: "explicit-empty-bootstrap-v1",
        }
        : await new JsonConfigurationImporter().prepare(
          resolve(values.file!),
          values.history ? resolve(values.history) : undefined,
        );
      if (!values["dry-run"])
        await (
          await manager.getRepository()
        ).initialize(prepared.revisions, prepared.importId);
      console.log(
        JSON.stringify({
          dryRun: values["dry-run"],
          snapshots: prepared.revisions.length,
          importId: prepared.importId,
          note: "Legacy history order uses file timestamps; import preserves every snapshot and leaves source files untouched.",
        }),
      );
    } else if (command === "export-json") {
      if (!values.out)
        throw new Error(
          "Specify --out <file>. Existing files are not overwritten.",
        );
      const snapshot = await (await manager.getService()).read();
      await writeFile(
        resolve(values.out),
        `${JSON.stringify(snapshot.routes, null, 2)}\n`,
        { mode: 0o600, flag: "wx" },
      );
      console.log(
        JSON.stringify({ exported: true, revision: snapshot.revision }),
      );
    } else {
      const repo = await manager.getRepository();
      console.log(
        JSON.stringify({ ...manager.getStatus(), revision: await repo.head() }),
      );
    }
  } finally {
    await manager.close();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Route database command failed.",
  );
  process.exitCode = 1;
});
