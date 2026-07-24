import type { Request } from "express";
import type { RequestKeyExtractor } from "./RequestKeyExtractor";

/** Extracts the client IP address from `req.ip`. */
export class IpKeyExtractor implements RequestKeyExtractor {
  extract(req: Request): string | null {
    return req.ip ?? null;
  }
}
