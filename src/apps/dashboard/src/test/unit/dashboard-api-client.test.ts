// @vitest-environment jsdom
import { HttpMethod } from "@shared/http/HttpMethod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpManager } from "@shared/services/networking";
import { DashboardApiClient } from "@/modules/configuration/services/dashboard-api-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DashboardApiClient", () => {
  it("downloads through a mock transport and releases the object URL", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:test-export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const http = createHttpManager({
      mode: "mock",
      routes: [
        {
          method: HttpMethod.GET,
          path: "/api/config/export",
          respond: () => new Response('{"routes":[]}'),
        },
      ],
    });
    const client = new DashboardApiClient(http);
    vi.spyOn(client, "getDashboardToken").mockReturnValue("");
    await client.downloadConfiguration();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-export");
  });
});
