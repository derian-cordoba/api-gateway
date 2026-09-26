import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { GET, PUT } from "@/app/api/route-sources/[id]/config/route";
import { GET as list } from "@/app/api/route-sources/route";
import { POST as check } from "@/app/api/route-sources/[id]/check/route";
import { POST as activate } from "@/app/api/route-sources/[id]/activate/route";
import { getSourceManager } from "@/server/route-sources/source-manager";
import { HttpMethod } from "@shared/http/HttpMethod";
import { StatusCodes } from "http-status-codes";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "source-api-"));
  vi.stubEnv("DASHBOARD_TOKEN", "test-token");
  vi.stubEnv("ROUTE_STORAGE_DRIVER", "local-json");
  vi.stubEnv("ROUTES_FILE_PATH", join(directory, "default.json"));
  vi.stubEnv("CANDIDATE_PATH", join(directory, "candidate.json"));
  vi.stubEnv(
    "ROUTE_SOURCE_PROFILES",
    JSON.stringify([
      { id: "candidate", name: "Candidate", driver: "local-json", connectionEnv: "CANDIDATE_PATH" },
    ]),
  );
  vi.stubEnv("GATEWAY_MANAGEMENT_URL", "");
  await writeFile(join(directory, "default.json"), "[]\n");
  await writeFile(join(directory, "candidate.json"), "[]\n");
});
afterEach(async () => {
  await getSourceManager().close();
  delete (globalThis as typeof globalThis & { dashboardRouteSources?: unknown })
    .dashboardRouteSources;
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
function request(method = HttpMethod.GET, body?: unknown, token = "test-token") {
  return new NextRequest("http://localhost/api/route-sources/candidate/config", {
    method,
    headers: { "X-Dashboard-Token": token, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const context = (id = "candidate") => ({ params: Promise.resolve({ id }) });
describe("named source API", () => {
  it("writes only the requested source and preserves the source identity", async () => {
    expect((await PUT(request(HttpMethod.PUT, { routes: [] }), context())).status).toBe(
      StatusCodes.PRECONDITION_REQUIRED,
    );
    const current = await (await GET(request(), context())).json();
    expect(current.sourceId).toBe("candidate");
    const routes = [{ baseURL: "/candidate", proxy: { target: "http://localhost:4100" } }];
    const response = await PUT(
      request(HttpMethod.PUT, { routes, expectedRevision: current.revision }),
      context(),
    );
    expect(response.status).toBe(StatusCodes.OK);
    expect((await response.json()).sourceId).toBe("candidate");
    expect(JSON.parse(await readFile(join(directory, "candidate.json"), "utf8"))).toEqual(routes);
    expect(JSON.parse(await readFile(join(directory, "default.json"), "utf8"))).toEqual([]);
    expect(
      (
        await PUT(
          request(HttpMethod.PUT, { routes: [], expectedRevision: current.revision }),
          context(),
        )
      ).status,
    ).toBe(StatusCodes.CONFLICT);
  });
  it("redacts source connections and checks health independently of gateway availability", async () => {
    const response = await list(request());
    expect(response.status).toBe(StatusCodes.OK);
    const body = await response.json();
    expect(body.runtime).toBeNull();
    expect(JSON.stringify(body)).not.toContain(directory);
    const health = await (await check(request(HttpMethod.POST), context())).json();
    expect(health).toMatchObject({ sourceId: "candidate", routeCount: 0, status: "ready" });
  });
  it("authorizes reads and writes and rejects unknown sources and invalid activations", async () => {
    expect((await GET(request(HttpMethod.GET, undefined, "wrong"), context())).status).toBe(
      StatusCodes.UNAUTHORIZED,
    );
    expect((await GET(request(), context("missing"))).status).toBe(StatusCodes.NOT_FOUND);
    expect((await activate(request(HttpMethod.POST, {}), context())).status).toBe(
      StatusCodes.BAD_REQUEST,
    );
  });
});
