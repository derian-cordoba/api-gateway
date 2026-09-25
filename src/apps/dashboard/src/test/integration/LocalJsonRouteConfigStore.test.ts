import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

  it("adds the configuration file path when stored JSON is malformed", async () => {
    await writeFile(filePath, "{invalid", "utf8");

    await expect(new LocalJsonRouteConfigStore(filePath).read()).rejects.toMatchObject({
      message: `Could not parse route configuration at ${filePath}`,
      cause: expect.any(SyntaxError),
    });
  });

  it("keeps revisions and can restore a previous configuration", async () => {
    const store = new LocalJsonRouteConfigStore(filePath);
    const initial = await store.read();
    const first = await store.write(
      [{ baseURL: "/first", proxy: { target: "http://localhost:4100" } }],
      initial.revision,
    );
    const second = await store.write(
      [{ baseURL: "/second", proxy: { target: "http://localhost:4200" } }],
      first.revision,
    );

    const history = await store.listHistory();
    expect(history.map((entry) => entry.revision)).toContain(first.revision);
    const restored = await store.restore(first.revision, second.revision);
    expect(restored.routes[0].baseURL).toBe("/first");
  });
});
