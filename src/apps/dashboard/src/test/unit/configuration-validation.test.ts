import { describe, expect, it } from "vitest";
import { validateConfiguration } from "@/server/configuration/configuration-validation";

const route = (baseURL: string) => ({
  baseURL,
  proxy: { target: "http://localhost:4100" },
});

describe("dashboard route validation", () => {
  it("rejects duplicate prefixes before writing configuration", () => {
    expect(validateConfiguration([route("/api"), route("/api")])).toMatchObject({
      success: false,
      issues: [{ path: [1, "baseURL"], message: "Duplicate route prefix: /api" }],
    });
  });

  it("accepts nested prefixes and explains their precedence", () => {
    expect(validateConfiguration([route("/api"), route("/api/admin")])).toMatchObject({
      success: true,
      warnings: [{ message: expect.stringContaining("longer prefix takes precedence") }],
    });
  });
});
