import { describe, expect, it } from "vitest";
import { toError } from "../../../src/shared/errors/toError";

describe("toError", () => {
  it("returns an Error unchanged", () => {
    const cause = new TypeError("invalid value");

    expect(toError(cause)).toBe(cause);
  });

  it("converts a string without adding JSON quotes", () => {
    const error = toError("offline");

    expect(error.message).toBe("offline");
    expect(error.cause).toBe("offline");
  });

  it("serializes plain values and objects", () => {
    expect(toError({ code: "FAILED", retryable: false }).message).toBe(
      '{"code":"FAILED","retryable":false}',
    );
    expect(toError(42).message).toBe("42");
    expect(toError(null).message).toBe("null");
  });

  it("falls back when JSON serialization returns undefined", () => {
    expect(toError(undefined).message).toBe("Unknown error");
    expect(toError(Symbol("failure")).message).toBe("Symbol(failure)");
  });

  it("falls back when JSON serialization throws", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(toError(circular).message).toBe("[object Object]");
    expect(toError(1n).message).toBe("1");
  });

  it("always returns an Error when both serialization strategies throw", () => {
    const cause = Object.create(null) as Record<string, unknown>;
    cause.self = cause;

    expect(toError(cause).message).toBe("Unknown error");
  });
});
