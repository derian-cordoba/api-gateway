import { afterEach, describe, expect, it, vi } from "vitest";
import {
  observatoryApi,
  ObservatoryApiError,
} from "@/modules/overview/services/observatory-api";

describe("observatoryApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests events with the selected limit and disables caching", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ events: [], nextCursor: null })),
      );
    vi.stubGlobal("fetch", fetchMock);

    await observatoryApi.getEvents(25);

    expect(fetchMock).toHaveBeenCalledWith("/api/gateway/events?limit=25", {
      cache: "no-store",
    });
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
