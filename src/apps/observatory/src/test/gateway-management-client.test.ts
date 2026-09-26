import { HttpMethod } from "@shared/http/HttpMethod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusCodes } from "http-status-codes";
import { createHttpManager } from "@shared/services/networking";
import { GatewayManagementClient } from "@/server/gateway/GatewayManagementClient";

describe("GatewayManagementClient", () => {
  afterEach(() => vi.unstubAllGlobals());
  const config = {
    baseUrl: new URL("https://gateway.test/management/"),
    token: "test-token",
  };

  it("retains the management prefix, authentication and selected event limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ events: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      new GatewayManagementClient(config).events(25),
    ).resolves.toEqual({ events: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gateway.test/management/v1/events?limit=25",
      expect.objectContaining({
        headers: new Headers({ Authorization: "Bearer test-token" }),
        cache: "no-store",
      }),
    );
  });

  it("preserves rejected-token status for the API route's error mapping", async () => {
    const http = createHttpManager({
      mode: "mock",
      routes: [
        {
          method: HttpMethod.GET,
          path: "/v1/overview",
          respond: () =>
            new Response(null, { status: StatusCodes.UNAUTHORIZED }),
        },
      ],
    });
    await expect(
      new GatewayManagementClient(config, http).overview(),
    ).rejects.toMatchObject({
      name: "GatewayManagementError",
      status: StatusCodes.UNAUTHORIZED,
      message: "The gateway management token was rejected.",
      cause: { kind: "http" },
    });
  });
});
