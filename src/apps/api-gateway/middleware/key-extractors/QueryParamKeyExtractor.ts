import type { Request } from "express";
import type { RequestKeyExtractor } from "./RequestKeyExtractor";

/**
 * Extracts the value of a named query-string parameter.
 *
 * Returns `null` when the parameter is absent or not a plain string value
 * (arrays are intentionally ignored to avoid ambiguous key derivation).
 */
export class QueryParamKeyExtractor implements RequestKeyExtractor {
  constructor(private readonly paramName: string) {}

  extract(req: Request): string | null {
    const value = req.query[this.paramName];
    return typeof value === "string" ? value : null;
  }
}
