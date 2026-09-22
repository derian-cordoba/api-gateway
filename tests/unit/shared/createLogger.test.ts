import { describe, expect, it } from "vitest";
import { createLogger } from "../../../src/shared/logging/createLogger";

describe("createLogger", () => {
  it("creates a named logger with the configured level", () => {
    const logger = createLogger({
      service: "test-service",
      level: "silent",
    });

    expect(logger.level).toBe("silent");
    expect(logger.bindings()).toMatchObject({ name: "test-service" });
  });
});
