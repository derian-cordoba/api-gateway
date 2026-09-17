import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalJsonRouteConfigStore } from "@/server/configuration/LocalJsonRouteConfigStore";
import { ConfigurationConflictError } from "@/server/errors/ConfigurationConflictError";

describe("LocalJsonRouteConfigStore", () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "gateway-dashboard-"));
    filePath = join(directory, "routes.json");
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("returns an empty configuration when the file does not exist", async () => {
    const result = await new LocalJsonRouteConfigStore(filePath).read();
    expect(result.routes).toEqual([]);
    expect(result.updatedAt).toBeNull();
    expect(result.revision).toHaveLength(16);
  });

  it("validates and atomically persists a complete route document", async () => {
    const store = new LocalJsonRouteConfigStore(filePath);
    const initial = await store.read();
    const saved = await store.write(
      [{ baseURL: "/products", proxy: { target: "http://localhost:4100" } }],
      initial.revision,
    );

    expect(saved.routes[0].baseURL).toBe("/products");
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual(saved.routes);
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it("rejects a save made against a stale revision", async () => {
    const store = new LocalJsonRouteConfigStore(filePath);
    const initial = await store.read();
    await store.write(
      [{ baseURL: "/first", proxy: { target: "http://localhost:4100" } }],
      initial.revision,
    );

    await expect(
      store.write(
        [{ baseURL: "/second", proxy: { target: "http://localhost:4200" } }],
        initial.revision,
      ),
    ).rejects.toBeInstanceOf(ConfigurationConflictError);
  });
});
