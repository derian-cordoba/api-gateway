// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardToken } from "@/modules/configuration/hooks/useDashboardToken";

describe("useDashboardToken", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
  });

  it("persists the trimmed token and notifies settings to refresh", () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useDashboardToken(onSaved));

    act(() => result.current.setToken("  secret  "));
    act(() => result.current.save());

    expect(window.localStorage.getItem("gateway-dashboard-token")).toBe("secret");
    expect(result.current.saved).toBe(true);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("hides the token after 30 seconds", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDashboardToken(vi.fn()));

    act(() => result.current.showToken());
    expect(result.current.isVisible).toBe(true);

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.isVisible).toBe(false);
  });

  it("copies the token and briefly reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { result } = renderHook(() => useDashboardToken(vi.fn()));
    act(() => result.current.setToken("secret-token"));

    await act(async () => result.current.copyToken());

    expect(writeText).toHaveBeenCalledWith("secret-token");
    expect(result.current.copyStatus).toBe("copied");
  });
});
