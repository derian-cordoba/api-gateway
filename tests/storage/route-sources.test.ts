import { createRevision } from "../../src/modules/route-configuration/domain/revision";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RouteSourceRegistry } from "../../src/modules/route-sources/RouteSourceRegistry";
import { RouteSourceManager } from "../../src/modules/route-sources/RouteSourceManager";
import { SourceSelectionStore } from "../../src/modules/route-sources/SourceSelectionStore";
import { ManagedRouteReloader } from "../../src/apps/api-gateway/routes/ManagedRouteReloader";
import { ProxyManager } from "../../src/apps/api-gateway/routes/ProxyManager";
import { Router } from "express";

let directory: string;
let env: NodeJS.ProcessEnv;
const runtimes: ManagedRouteReloader[] = [];
const controls: SourceSelectionStore[] = [];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "named-route-sources-"));
  env = {
    ROUTES_FILE_PATH: join(directory, "default.json"),
    ROUTE_CONTROL_SQLITE_PATH: join(directory, "control.sqlite"),
    CANDIDATE_FILE: join(directory, "candidate.json"),
    ROUTE_SOURCE_PROFILES: JSON.stringify([
      {
        id: "candidate",
        name: "Candidate",
        driver: "local-json",
        connectionEnv: "CANDIDATE_FILE",
      },
    ]),
  };
  await writeFile(env.ROUTES_FILE_PATH!, "[]\n");
  await writeFile(
    env.CANDIDATE_FILE!,
    '[{"baseURL":"/candidate","proxy":{"target":"http://localhost:4100"}}]\n',
  );
});
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.stop();
  for (const control of controls.splice(0)) await control.close();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});
function runtime() {
  const sources = new RouteSourceManager(new RouteSourceRegistry(env));
  const control = new SourceSelectionStore(env);
  const instance = new ManagedRouteReloader(
    undefined,
    undefined,
    {},
    undefined,
    undefined,
    sources,
    control,
  );
  runtimes.push(instance);
  return { instance, sources };
}

describe("named route source registry", () => {
  it("exposes safe summaries and requires explicit environments for remote profiles", () => {
    const registry = new RouteSourceRegistry(env);
    expect(registry.list()).toHaveLength(2);
    expect(JSON.stringify(registry.list())).not.toContain(directory);
    expect(registry.resolve("candidate").filePath).toBe(env.CANDIDATE_FILE);
    expect(() => registry.resolve("unknown")).toThrow("Unknown route source");
    expect(
      () =>
        new RouteSourceRegistry({
          ROUTE_SOURCE_PROFILES:
            '[{"id":"remote","name":"Remote","driver":"postgres","connectionEnv":"SECRET"}]',
        }),
    ).toThrow("Remote profiles require");
  });
  it("does not let a source profile override the reserved default", () => {
    expect(
      () =>
        new RouteSourceRegistry({
          ROUTE_SOURCE_PROFILES:
            '[{"id":"default","name":"Override","driver":"sqlite","connectionEnv":"DB"}]',
        }),
    ).toThrow("default is reserved");
  });
});

describe("durable source activation", () => {
  it("compares activation versions across independent connections and survives reopening", async () => {
    const first = new SourceSelectionStore(env),
      second = new SourceSelectionStore(env);
    controls.push(first, second);
    await first.read();
    await second.read();
    const results = await Promise.allSettled([
      first.select("candidate", 0),
      second.select("default", 0),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const desired = await first.read();
    expect(desired.version).toBe(1);
    await first.close();
    expect(await first.read()).toEqual(desired);
  });
  it("preserves applied routes on failed preparation and restores selection after restart", async () => {
    const dispose = vi.fn();
    const build = vi.spyOn(ProxyManager, "build").mockResolvedValue({
      router: Router(),
      routes: [],
      wsHandlers: [],
      dispose,
    });
    const { instance, sources } = runtime();
    await instance.start();
    const candidate = await sources.snapshot("candidate");
    await expect(
      instance.activate("candidate", 0, "a".repeat(16)),
    ).rejects.toThrow();
    build.mockRejectedValueOnce(new Error("build failed"));
    await expect(
      instance.activate("candidate", 0, candidate.revision),
    ).rejects.toThrow("build failed");
    expect((await instance.status()).applied?.sourceId).toBe("default");
    expect(dispose).not.toHaveBeenCalled();
    const activated = await instance.activate(
      "candidate",
      0,
      candidate.revision,
    );
    expect(activated.applied).toEqual({ sourceId: "candidate", version: 1 });
    expect(dispose).toHaveBeenCalledOnce();
    await expect(
      instance.activate("default", 0, candidate.revision),
    ).rejects.toThrow();
    await instance.stop();
    runtimes.splice(runtimes.indexOf(instance), 1);
    const restarted = runtime().instance;
    await restarted.start();
    expect((await restarted.status()).applied).toEqual(activated.applied);
  });
  it("disposes a prepared router if another gateway wins activation", async () => {
    const { instance, sources } = runtime();
    const control = new SourceSelectionStore(env);
    controls.push(control);
    vi.spyOn(ProxyManager, "build").mockResolvedValue({
      router: Router(),
      routes: [],
      wsHandlers: [],
    });
    await instance.start();
    const dispose = vi.fn();
    vi.mocked(ProxyManager.build).mockImplementationOnce(async () => {
      await control.select("default", 0);
      return { router: Router(), routes: [], wsHandlers: [], dispose };
    });
    const candidate = await sources.snapshot("candidate");
    await expect(
      instance.activate("candidate", 0, candidate.revision),
    ).rejects.toThrow();
    expect(dispose).toHaveBeenCalledOnce();
    expect((await instance.status()).applied?.sourceId).toBe("default");
  });
});

it.skipIf(!process.env.TEST_POSTGRES_URL)(
  "uses PostgreSQL for shared activation control",
  async () => {
    const controlEnv = {
      ROUTE_CONTROL_POSTGRES_URL: process.env.TEST_POSTGRES_URL,
    };
    const first = new SourceSelectionStore(controlEnv),
      second = new SourceSelectionStore(controlEnv);
    controls.push(first, second);
    const current = await first.read();
    await second.read();
    const results = await Promise.allSettled([
      first.select("candidate", current.version),
      second.select("default", current.version),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect((await second.read()).version).toBe(current.version + 1);
  },
);

it("discovers each configured driver and both remote environments without changing the default", () => {
  const registry = new RouteSourceRegistry({
    ...env,
    ROUTE_STORAGE_DRIVER: "local-json",
    ROUTE_SQLITE_PATH: join(directory, "routes.sqlite"),
    ROUTE_POSTGRES_DEVELOPMENT_URL: "postgresql://localhost/dev",
    ROUTE_POSTGRES_PRODUCTION_URL: "postgresql://localhost/prod",
    ROUTE_MONGODB_DEVELOPMENT_URI: "mongodb://localhost",
    ROUTE_MONGODB_DEVELOPMENT_DATABASE: "dev",
  });
  expect(registry.list().map(({ id }) => id)).toEqual(
    expect.arrayContaining([
      "default",
      "storage-sqlite",
      "storage-postgres-development",
      "storage-postgres-production",
      "storage-mongodb-development",
    ]),
  );
  expect(registry.resolve("default").filePath).toBe(env.ROUTES_FILE_PATH);
  expect(registry.resolve("storage-postgres-production").storage).toMatchObject(
    {
      driver: "postgres",
      environment: "production",
      url: "postgresql://localhost/prod",
    },
  );
  expect(registry.resolve("storage-mongodb-development").storage).toMatchObject(
    { driver: "mongodb", environment: "development", database: "dev" },
  );
  expect(JSON.stringify(registry.list())).not.toContain("postgresql://");
});

it("keeps Legacy JSON available when the startup default is a database", () => {
  const registry = new RouteSourceRegistry({
    ...env,
    ROUTE_STORAGE_DRIVER: "sqlite",
    ROUTE_SQLITE_PATH: join(directory, "routes.sqlite"),
  });
  expect(registry.resolve("storage-json").filePath).toBe(env.ROUTES_FILE_PATH);
  expect(
    registry.list().filter((source) => source.driver === "sqlite"),
  ).toHaveLength(1);
});

it("switches from Legacy JSON to the discovered SQLite driver and back", async () => {
  env.ROUTE_SQLITE_PATH = join(directory, "switch.sqlite");
  const { instance, sources } = runtime();
  const database = sources.database("storage-sqlite");
  await database.migrate();
  await (
    await database.getRepository()
  ).initialize([createRevision([])], "seed");
  vi.spyOn(ProxyManager, "build").mockResolvedValue({
    router: Router(),
    routes: [],
    wsHandlers: [],
  });
  await instance.start();
  const sqliteSnapshot = await sources.snapshot("storage-sqlite");
  expect(
    (await instance.activate("storage-sqlite", 0, sqliteSnapshot.revision))
      .applied?.sourceId,
  ).toBe("storage-sqlite");
  const jsonSnapshot = await sources.snapshot("default");
  expect(
    (await instance.activate("default", 1, jsonSnapshot.revision)).applied
      ?.sourceId,
  ).toBe("default");
});
