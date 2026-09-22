import { describe, expect, it, vi } from "vitest";
import { abortableDelay } from "../../../src/shared/async/abortableDelay";
import { assertNever } from "../../../src/shared/assertions/assertNever";
import { isErrorWithCode } from "../../../src/shared/errors/isErrorWithCode";
import { isRecord } from "../../../src/shared/guards/isRecord";
import { getHeaderValue } from "../../../src/shared/http/getHeaderValue";
import { tryParseJson } from "../../../src/shared/json/tryParseJson";
import { findRoutePrefixConflicts } from "../../../src/shared/routes/findRoutePrefixConflicts";
import { timingSafeStringEqual } from "../../../src/shared/security/timingSafeStringEqual";

describe("shared utilities", () => {
  it("recognizes errors with a specific code", () => {
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });

    expect(isErrorWithCode(error, "ENOENT")).toBe(true);
    expect(isErrorWithCode(error, "EACCES")).toBe(false);
    expect(isErrorWithCode({ code: "ENOENT" }, "ENOENT")).toBe(false);
  });

  it("compares strings without requiring equal input lengths", () => {
    expect(timingSafeStringEqual("dashboard-secret", "dashboard-secret")).toBe(
      true,
    );
    expect(timingSafeStringEqual("dashboard-secret", "wrong")).toBe(false);
  });

  it("finds exact and nested route prefix conflicts", () => {
    expect(
      findRoutePrefixConflicts([
        { baseURL: "/api" },
        { baseURL: "/api/users" },
        { baseURL: "/apix" },
        { baseURL: "/api" },
      ]),
    ).toEqual([
      {
        firstIndex: 0,
        secondIndex: 1,
        firstPrefix: "/api",
        secondPrefix: "/api/users",
        exact: false,
      },
      {
        firstIndex: 0,
        secondIndex: 3,
        firstPrefix: "/api",
        secondPrefix: "/api",
        exact: true,
      },
      {
        firstIndex: 1,
        secondIndex: 3,
        firstPrefix: "/api/users",
        secondPrefix: "/api",
        exact: false,
      },
    ]);
  });

  it("gets the first available header value", () => {
    expect(getHeaderValue("one")).toBe("one");
    expect(getHeaderValue(["one", "two"])).toBe("one");
    expect(getHeaderValue(undefined)).toBeUndefined();
  });

  it("delays until its timer completes and removes the abort listener", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const delayed = abortableDelay(25, controller.signal);

    await vi.advanceTimersByTimeAsync(25);

    await expect(delayed).resolves.toBeUndefined();
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
    vi.useRealTimers();
  });

  it("rejects an abortable delay when its signal is aborted", async () => {
    const controller = new AbortController();
    const delayed = abortableDelay(1_000, controller.signal);

    controller.abort();

    await expect(delayed).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects unhandled discriminated-union values", () => {
    expect(() => assertNever("future" as never, "status")).toThrow(
      "Unhandled status: future",
    );
  });

  it("recognizes records without accepting arrays or null", () => {
    expect(isRecord({ value: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it("parses valid JSON and returns invalid JSON as an Error", () => {
    expect(tryParseJson('{"ready":true}')).toEqual({
      success: true,
      value: { ready: true },
    });

    const invalid = tryParseJson("{");
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error).toBeInstanceOf(Error);
  });
});
