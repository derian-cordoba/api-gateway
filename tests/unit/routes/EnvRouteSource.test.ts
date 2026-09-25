import { afterEach, describe, expect, it } from "vitest";
import { EnvRouteSource } from "../../../src/apps/api-gateway/routes/route-sources/EnvRouteSource";

const originalRoutes = process.env.ROUTES;

afterEach(() => {
  if (originalRoutes === undefined) delete process.env.ROUTES;
  else process.env.ROUTES = originalRoutes;
});

describe("EnvRouteSource", () => {
  it("rejects malformed ROUTES JSON instead of silently loading no routes", async () => {
    process.env.ROUTES = "{not-json";
    await expect(new EnvRouteSource().load()).rejects.toThrow("Could not parse ROUTES env var as JSON");
  });
});
