import type { Request } from "express";

/**
 * Extracts a rate-limit or session-affinity key from an incoming request.
 *
 * Returns `null` when the key source is absent (e.g. a missing header or
 * cookie). The caller is responsible for providing a fallback.
 */
export interface RequestKeyExtractor {
  extract(req: Request): string | null;
}
