// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRawRouteEditor } from "@/modules/routes/hooks/useRawRouteEditor";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

describe("useRawRouteEditor", () => {
  it("keeps the JSON editor open until the route is valid", () => {
    const route: GatewayRoute = {
      baseURL: "/events",
      proxy: { target: "http://localhost:4100" },
    };
    const onChange = vi.fn();
    const { result } = renderHook(() => useRawRouteEditor(route, onChange));

    act(() => result.current.toggleRaw());
    act(() => result.current.setRaw("{"));
    act(() => result.current.toggleRaw());
    expect(result.current.rawMode).toBe(true);
    expect(result.current.rawError).toMatch(/valid JSON/);
    expect(onChange).not.toHaveBeenCalled();

    act(() => result.current.setRaw(JSON.stringify({ baseURL: "/events" })));
    act(() => result.current.toggleRaw());
    expect(result.current.rawError).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    act(() => result.current.setRaw(JSON.stringify({ ...route, baseURL: "/events-v2" })));
    act(() => result.current.toggleRaw());
    expect(onChange).toHaveBeenCalledWith({ ...route, baseURL: "/events-v2" });
    expect(result.current.rawMode).toBe(false);
  });
});
