import { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import type { RequestKeyExtractor } from "./RequestKeyExtractor";

/** Extracts the client IP address from `req.ip`, normalising IPv6-mapped IPv4 addresses. */
export class IpKeyExtractor implements RequestKeyExtractor {
  extract(req: Request): string | null {
    if (req.ip === undefined) return null;
    return ipKeyGenerator(req.ip) ?? null;
  }
}
