import { HttpMethod } from "@shared/http/HttpMethod";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  observatoryApi,
  ObservatoryApiError,
  ObservatoryApiService,
} from "@/modules/overview/services/observatory-api";
import { createHttpManager } from "@shared/services/networking";

describe("observatoryApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses an injected mock manager through the real domain service", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const api = new ObservatoryApiService(
      createHttpManager({
        mode: "mock",
        routes: [
          {
            method: HttpMethod.GET,
            path: "/api/gateway/events",
            respond: ({ url }) =>
              Response.json({
                events: [],
                limit: Number(url.searchParams.get("limit")),
              }),
          },
        ],
      }),
    );
    await expect(api.getEvents(10)).resolves.toEqual({ events: [], limit: 10 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests events with the selected limit and disables caching", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ events: [], nextCursor: null })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await observatoryApi.getEvents(25);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gateway/events?limit=25",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
  });

  it("rejects event limits outside the supported range", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(observatoryApi.getEvents(101)).rejects.toThrow(
      ObservatoryApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the API error message for unsuccessful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Gateway is unavailable." }), {
          status: 503,
        }),
      ),
    );

    await expect(observatoryApi.getOverview()).rejects.toMatchObject({
      name: "ObservatoryApiError",
      message: "Gateway is unavailable.",
      status: 503,
    });
  });
});
