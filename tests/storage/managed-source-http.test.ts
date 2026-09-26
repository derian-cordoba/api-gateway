import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:http";
import express from "express";
import supertest from "supertest";
import { StatusCodes } from "http-status-codes";
import { ManagedRouteReloader } from "../../src/apps/api-gateway/routes/ManagedRouteReloader";
import { RouteSourceManager } from "../../src/modules/route-sources/RouteSourceManager";
import { RouteSourceRegistry } from "../../src/modules/route-sources/RouteSourceRegistry";
import { SourceSelectionStore } from "../../src/modules/route-sources/SourceSelectionStore";

let directory: string;
let upstream: Server;
const runtimes: ManagedRouteReloader[] = [];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "managed-source-http-"));
  vi.stubEnv("ROUTES", "[]");
  upstream = createServer((_req, res) => res.end("upstream-ok"));
  await new Promise<void>((resolve) =>
    upstream.listen(0, "127.0.0.1", resolve),
  );
});
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.stop();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
it("switches live routes, converges other instances, and serves last good routes during an outage", async () => {
  const address = upstream.address();
  if (!address || typeof address === "string")
    throw new Error("Missing upstream port");
  const target = `http://127.0.0.1:${address.port}`;
  const candidate = JSON.stringify([{ baseURL: "/second", proxy: { target } }]);
  const env = {
    ROUTES_FILE_PATH: join(directory, "default.json"),
    CANDIDATE_PATH: join(directory, "candidate.json"),
    ROUTE_CONTROL_SQLITE_PATH: join(directory, "control.sqlite"),
    ROUTE_SOURCE_PROFILES: JSON.stringify([
      {
        id: "candidate",
        name: "Candidate",
        driver: "local-json",
        connectionEnv: "CANDIDATE_PATH",
      },
    ]),
  };
  await writeFile(
    env.ROUTES_FILE_PATH,
    JSON.stringify([{ baseURL: "/first", proxy: { target } }]),
  );
  await writeFile(env.CANDIDATE_PATH, candidate);
  const sources = new RouteSourceManager(new RouteSourceRegistry(env));
  const first = new ManagedRouteReloader(
    undefined,
    undefined,
    {},
    undefined,
    undefined,
    sources,
    new SourceSelectionStore(env),
  );
  const second = new ManagedRouteReloader(
    undefined,
    undefined,
    {},
    undefined,
    undefined,
    new RouteSourceManager(new RouteSourceRegistry(env)),
    new SourceSelectionStore(env),
  );
  runtimes.push(first, second);
  await first.start();
  await second.start();
  const app = express().use(first.getDelegatorMiddleware());
  const otherApp = express().use(second.getDelegatorMiddleware());
  expect((await supertest(app).get("/first")).text).toBe("upstream-ok");
  await first.activate(
    "candidate",
    0,
    (await sources.snapshot("candidate")).revision,
  );
  expect((await supertest(app).get("/second")).text).toBe("upstream-ok");
  expect((await supertest(app).get("/first")).status).toBe(
    StatusCodes.NOT_FOUND,
  );
  await vi.waitFor(
    async () =>
      expect((await second.status()).applied?.sourceId).toBe("candidate"),
    { timeout: 4000 },
  );
  expect((await supertest(otherApp).get("/second")).text).toBe("upstream-ok");
  await writeFile(env.CANDIDATE_PATH, "invalid");
  await vi.waitFor(
    async () => expect((await first.status()).status).toBe("degraded"),
    { timeout: 4000 },
  );
  expect((await supertest(app).get("/second")).text).toBe("upstream-ok");
  await writeFile(env.CANDIDATE_PATH, candidate);
  await vi.waitFor(
    async () => expect((await first.status()).status).toBe("synchronized"),
    { timeout: 4000 },
  );
}, 15000);
