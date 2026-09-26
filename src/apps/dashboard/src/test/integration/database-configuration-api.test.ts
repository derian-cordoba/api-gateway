import { HttpMethod } from "@shared/http/HttpMethod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { StatusCodes } from "http-status-codes";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET, PUT } from "@/app/api/config/route";
import { POST as restore } from "@/app/api/config/history/route";
import { GET as exportConfig } from "@/app/api/config/export/route";
import { GET as status } from "@/app/api/status/route";
import { getRouteStorageManager } from "../../../../../modules/route-configuration/infrastructure/RouteStorageManager";
import { createRevision } from "../../../../../modules/route-configuration/domain/revision";

describe("database configuration API", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "dashboard-database-"));
    vi.stubEnv("ROUTE_STORAGE_DRIVER", "sqlite");
    vi.stubEnv("ROUTE_SQLITE_PATH", join(directory, "routes.sqlite"));
    vi.stubEnv("DASHBOARD_TOKEN", "test-token");
    const manager = getRouteStorageManager();
    await manager.migrate();
    await (await manager.getRepository()).initialize([createRevision([])], "seed");
  });
  afterEach(async () => {
    await getRouteStorageManager().close();
    delete (globalThis as typeof globalThis & { routeStorageManager?: unknown })
      .routeStorageManager;
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });
  function request(method: string, body?: unknown) {
    return new NextRequest("http://localhost/api/config", {
      method,
      headers: { "X-Dashboard-Token": "test-token", "Content-Type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  }
  it("saves, returns stale-write conflicts, and restores a database revision", async () => {
    const original = await (await GET(request(HttpMethod.GET))).json();
    const routes = [{ baseURL: "/orders", proxy: { target: "http://localhost:4100" } }];
    const response = await PUT(
      request(HttpMethod.PUT, { routes, expectedRevision: original.revision }),
    );
    expect(response.status).toBe(StatusCodes.OK);
    const saved = await response.json();
    expect(saved.revision).toHaveLength(32);
    expect(await (await exportConfig(request(HttpMethod.GET))).json()).toEqual(routes);
    expect(
      (await PUT(request(HttpMethod.PUT, { routes, expectedRevision: original.revision }))).status,
    ).toBe(StatusCodes.CONFLICT);
    const restoredResponse = await restore(
      request(HttpMethod.POST, { revision: original.revision, expectedRevision: saved.revision }),
    );
    expect(restoredResponse.status).toBe(StatusCodes.OK);
    expect((await restoredResponse.json()).routes).toEqual([]);
    expect(await (await status(request(HttpMethod.GET))).json()).toMatchObject({
      storage: "sqlite",
      configurationKey: "default",
      status: "ready",
    });
  });
  it("requires a revision precondition and reports missing revisions", async () => {
    expect((await PUT(request(HttpMethod.PUT, { routes: [] }))).status).toBe(
      StatusCodes.PRECONDITION_REQUIRED,
    );
    const original = await (await GET(request(HttpMethod.GET))).json();
    expect(
      (
        await restore(
          request(HttpMethod.POST, {
            revision: "a".repeat(32),
            expectedRevision: original.revision,
          }),
        )
      ).status,
    ).toBe(StatusCodes.NOT_FOUND);
  });
});
