import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayManagementClient } from "@/server/gateway/GatewayManagementClient";
import {
  DEFAULT_EVENT_LIMIT,
  isValidEventLimit,
} from "@/modules/overview/event-limit";

describe("event limits", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts integer limits supported by the gateway", () => {
    expect(isValidEventLimit(1)).toBe(true);
    expect(isValidEventLimit(100)).toBe(true);
    expect(isValidEventLimit(0)).toBe(false);
    expect(isValidEventLimit(101)).toBe(false);
    expect(isValidEventLimit(10.5)).toBe(false);
  });

  it("uses the default limit when none is specified", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ events: [], nextCursor: null })),
      );
    vi.stubEnv("GATEWAY_MANAGEMENT_URL", "http://localhost:3000/management");
    vi.stubEnv("GATEWAY_MANAGEMENT_TOKEN", "test-token");
    vi.stubGlobal("fetch", fetchMock);

    await new GatewayManagementClient().events();

    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe("/management/v1/events");
    expect(requestedUrl.searchParams.get("limit")).toBe(
      String(DEFAULT_EVENT_LIMIT),
    );
  });

  it("passes the requested event limit to the gateway", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ events: [], nextCursor: null })),
      );
    vi.stubEnv("GATEWAY_MANAGEMENT_URL", "http://localhost:3000/management");
    vi.stubEnv("GATEWAY_MANAGEMENT_TOKEN", "test-token");
    vi.stubGlobal("fetch", fetchMock);

    await new GatewayManagementClient().events(25);

    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.searchParams.get("limit")).toBe("25");
  });
});
