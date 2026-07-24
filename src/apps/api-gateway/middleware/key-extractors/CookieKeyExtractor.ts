import type { Request } from "express";
import type { RequestKeyExtractor } from "./RequestKeyExtractor";

/**
 * Extracts the value of a named cookie.
 *
 * Requires that `cookie-parser` middleware is mounted upstream, which
 * populates `req.cookies`. Returns `null` when the cookie is absent.
 */
export class CookieKeyExtractor implements RequestKeyExtractor {
  constructor(private readonly cookieName: string) {}

  extract(req: Request): string | null {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[this.cookieName] ?? null;
  }
}
