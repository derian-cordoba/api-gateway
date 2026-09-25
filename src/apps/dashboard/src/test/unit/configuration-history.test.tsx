// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useConfigurationHistory } from "@/modules/configuration/hooks/useConfigurationHistory";
import { configurationService } from "@/modules/configuration/services/configuration";

vi.mock("@/modules/configuration/hooks/useConfiguration", () => ({
  useConfiguration: () => ({
    configuration: { revision: "current" },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

afterEach(() => vi.restoreAllMocks());

describe("useConfigurationHistory", () => {
  it("reports a failed load and can retry", async () => {
    const entries = [{ revision: "previous", updatedAt: "2026-09-17T00:00:00.000Z" }];
    const history = vi.spyOn(configurationService, "history");
    history.mockRejectedValueOnce(new Error("History unavailable")).mockResolvedValue(entries);

    const { result } = renderHook(() => useConfigurationHistory());
    await waitFor(() => expect(result.current.historyLoading).toBe(false));
    expect(result.current.error).toBe("History unavailable");

    await act(async () => result.current.refreshHistory());
    expect(result.current.history).toEqual(entries);
    expect(result.current.error).toBeNull();
  });

  it("restores a revision after confirmation and refreshes history", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const history = vi.spyOn(configurationService, "history").mockResolvedValue([]);
    const restore = vi.spyOn(configurationService, "restore").mockResolvedValue({
      routes: [],
      revision: "restored",
      updatedAt: "2026-09-17T00:00:00.000Z",
      filePath: "/tmp/routes.json",
      warnings: [],
    });

    const { result } = renderHook(() => useConfigurationHistory());
    await waitFor(() => expect(result.current.historyLoading).toBe(false));

    await act(async () => result.current.restore("previous"));
    expect(restore).toHaveBeenCalledWith("previous");
    expect(history).toHaveBeenCalledTimes(2);
    expect(result.current.restoring).toBeNull();
  });
});
