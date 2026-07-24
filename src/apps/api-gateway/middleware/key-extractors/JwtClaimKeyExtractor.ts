import type { Request } from "express";
import { decode as jwtDecode } from "jsonwebtoken";
import type { RequestKeyExtractor } from "./RequestKeyExtractor";

/**
 * Extracts a claim from a decoded JWT Bearer token.
 *
 * The token is decoded without signature verification — upstream auth
 * middleware is expected to have already validated it.
 */
export class JwtClaimKeyExtractor implements RequestKeyExtractor {
  constructor(private readonly claim: string) {}

  extract(req: Request): string | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return null;

    const payload = jwtDecode(auth.slice(7));
    if (!payload || typeof payload !== "object") return null;

    const val = (payload as Record<string, unknown>)[this.claim];
    return val !== undefined && val !== null ? String(val) : null;
  }
}
