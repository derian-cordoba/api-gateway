import { afterEach, describe, expect, it } from "vitest";
import { Server } from "../../src/apps/api-gateway/Server";

const originalRoutes = process.env.ROUTES;

afterEach(() => {
  if (originalRoutes === undefined) delete process.env.ROUTES;
  else process.env.ROUTES = originalRoutes;
});

describe("gateway startup validation", () => {
  it("refuses to initialize when ROUTES contains invalid JSON", async () => {
    process.env.ROUTES = "{not-json";

    await expect(new Server().init()).rejects.toThrow("Could not parse ROUTES env var as JSON");
  });

  it("refuses to initialize when a route fails schema validation", async () => {
    process.env.ROUTES = JSON.stringify([{ baseURL: "/invalid", proxy: {} }]);

    await expect(new Server().init()).rejects.toThrow("Invalid route configuration");
  });
});
