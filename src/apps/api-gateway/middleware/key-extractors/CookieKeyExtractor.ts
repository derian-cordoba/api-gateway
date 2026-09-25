import type { Request } from "express";
import type { RequestKeyExtractor } from "./RequestKeyExtractor";

/**
 * Extracts the value of a named cookie.
 *
 * Reads parsed cookies when available and otherwise falls back to the raw
 * Cookie header, so the built-in gateway pipeline does not require an
 * additional cookie-parser dependency.
 */
export class CookieKeyExtractor implements RequestKeyExtractor {
  constructor(private readonly cookieName: string) { }

  extract(req: Request): string | null {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    if (cookies?.[this.cookieName] !== undefined) {
      return cookies[this.cookieName];
    }

    const rawCookie = req.headers.cookie;
    if (!rawCookie) {
      return null;
    }

    for (const segment of rawCookie.split(";")) {
      const separator = segment.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const name = segment.slice(0, separator).trim();
      if (name !== this.cookieName) {
        continue;
      }

      const value = segment.slice(separator + 1).trim();

      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }

    return null;
  }
}
