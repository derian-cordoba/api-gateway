import { describe, expect, it } from "vitest";
import { withErrorContext } from "../../../src/shared/errors/withErrorContext";

class ContextError extends Error {
  readonly code = "CONTEXT_ERROR";
}

describe("withErrorContext", () => {
  it("returns values from synchronous and asynchronous operations", async () => {
    await expect(withErrorContext(() => 42)).resolves.toBe(42);
    await expect(withErrorContext(async () => "ready")).resolves.toBe("ready");
  });

  it("rethrows an Error unchanged when no context is requested", async () => {
    const cause = new Error("original");

    await expect(withErrorContext(() => Promise.reject(cause))).rejects.toBe(
      cause,
    );
  });

  it("wraps a failure with a contextual message and native cause", async () => {
    const cause = new Error("invalid JSON");

    await expect(
      withErrorContext(() => Promise.reject(cause), {
        message: "Could not load routes",
      }),
    ).rejects.toMatchObject({
      message: "Could not load routes",
      cause,
    });
  });

  it("normalizes non-Error failures", async () => {
    await expect(
      withErrorContext(() => Promise.reject("offline")),
    ).rejects.toMatchObject({
      message: "offline",
      cause: "offline",
    });
  });

  it("creates a fresh domain exception and attaches its cause", async () => {
    const cause = new Error("database unavailable");

    await expect(
      withErrorContext(() => Promise.reject(cause), {
        createException: () => new ContextError("Configuration unavailable"),
      }),
    ).rejects.toMatchObject({
      name: "Error",
      message: "Configuration unavailable",
      code: "CONTEXT_ERROR",
      cause,
    });
  });

  it("does not turn an exception into its own cause", async () => {
    const cause = new ContextError("same exception");

    await expect(
      withErrorContext(() => Promise.reject(cause), {
        createException: () => cause,
      }),
    ).rejects.toBe(cause);
    expect(cause.cause).toBeUndefined();
  });
});
