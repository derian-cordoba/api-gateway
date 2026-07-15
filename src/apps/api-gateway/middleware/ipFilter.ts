import type { Request, Response, NextFunction, RequestHandler } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { IpFilter } from "../types/ip-filter";

// ── CIDR helpers ───────────────────────────────────────────────────────────

/**
 * Strip the IPv4-mapped IPv6 prefix so `::ffff:192.168.1.1` is treated the
 * same as `192.168.1.1` when matched against IPv4 rules.
 */
function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/i, "");
}

function ipv4ToUint32(ip: string): number {
  return ip.split(".").reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0);
}

/**
 * Returns true when `ip` falls inside `cidr`.
 * `cidr` may be a plain IPv4 address (exact match) or a CIDR range such as
 * `10.0.0.0/8`.
 */
export function matchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return ip === cidr;
  }

  const [network, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  return (ipv4ToUint32(ip) & mask) === (ipv4ToUint32(network) & mask);
}

function matchesAny(ip: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesCidr(ip, pattern));
}

// ── Middleware factory ─────────────────────────────────────────────────────

/**
 * Per-route IP allowlist / blocklist middleware.
 *
 * Evaluation order:
 *  1. `deny`  — request is rejected with 403 if the client IP matches.
 *  2. `allow` — request is rejected with 403 if the client IP does NOT match.
 *
 * When only `deny` is configured every IP passes except those explicitly blocked.
 * When only `allow` is configured only listed IPs pass.
 * When both are present `deny` takes precedence.
 */
export function createIpFilterMiddleware(config: IpFilter): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = normalizeIp(req.ip ?? req.socket.remoteAddress ?? "");

    if (config.deny && matchesAny(ip, config.deny)) {
      res.status(HttpStatus.FORBIDDEN).json({
        error: "Forbidden",
        message: "Your IP address is not permitted to access this resource",
      });
      return;
    }

    if (config.allow && !matchesAny(ip, config.allow)) {
      res.status(HttpStatus.FORBIDDEN).json({
        error: "Forbidden",
        message: "Your IP address is not permitted to access this resource",
      });
      return;
    }

    next();
  };
}
