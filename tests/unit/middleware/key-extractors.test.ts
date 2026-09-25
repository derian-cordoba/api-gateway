import { describe, expect, it } from "vitest";
import { CookieKeyExtractor } from "../../../src/apps/api-gateway/middleware/key-extractors/CookieKeyExtractor";

describe("CookieKeyExtractor", () => {
  it("extracts a cookie directly from the raw Cookie header", () => {
    const request = { headers: { cookie: "theme=dark; session_id=abc%20123" } } as never;
    expect(new CookieKeyExtractor("session_id").extract(request)).toBe("abc 123");
  });

  it("prefers cookies parsed by upstream middleware", () => {
    const request = {
      headers: { cookie: "session_id=raw" },
      cookies: { session_id: "parsed" },
    } as never;
    expect(new CookieKeyExtractor("session_id").extract(request)).toBe("parsed");
  });
});
