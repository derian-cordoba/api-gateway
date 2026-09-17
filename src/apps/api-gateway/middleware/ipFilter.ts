import type { Request, Response, NextFunction, RequestHandler } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { IpFilter } from "../types/ip-filter";
import { ErrorResponseFactory } from "./ErrorResponseFactory";

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
 * Returns true when `ip` falls inside `cidr` for IPv4 addresses.
 * `cidr` may be a plain IPv4 address (exact match) or a CIDR range such as
 * `10.0.0.0/8`.
 */
export function matchesIpv4Cidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) {
    return ip === cidr;
  }

  const [network, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr, 10);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

  return (ipv4ToUint32(ip) & mask) === (ipv4ToUint32(network) & mask);
}

// ── IPv6 CIDR helpers ──────────────────────────────────────────────────────

/** Expands a potentially compressed IPv6 address to its full 8-group form. */
function expandIpv6(address: string): string {
  if (!address.includes(":")) {
    throw new Error(`Not a valid IPv6 address: ${address}`);
  }

  const halves = address.split("::");
  if (halves.length > 2) throw new Error(`Invalid IPv6 address: ${address}`);

  const leftGroups = halves[0] ? halves[0].split(":") : [];
  const rightGroups = halves[1] ? halves[1].split(":") : [];
  const missingGroups = 8 - leftGroups.length - rightGroups.length;
  const expandedGroups = [
    ...leftGroups,
    ...Array<string>(missingGroups).fill("0000"),
    ...rightGroups,
  ];

  return expandedGroups.map((group) => group.padStart(4, "0")).join(":");
}

/** Converts a full (expanded) IPv6 address to a 128-bit BigInt. */
function ipv6ToBigInt(address: string): bigint {
  return expandIpv6(address)
    .split(":")
    .reduce(
      (accumulator, group) => (accumulator << 16n) | BigInt(parseInt(group, 16)),
      0n,
    );
}

/**
 * Returns true when `ip` falls inside `cidr` for IPv6 addresses.
 * `cidr` may be a plain IPv6 address (exact match) or a CIDR range like `2001:db8::/32`.
 */
function matchesIpv6Cidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip === cidr;

  const separatorIndex = cidr.lastIndexOf("/");
  const networkAddress = cidr.slice(0, separatorIndex);
  const prefixLength = parseInt(cidr.slice(separatorIndex + 1), 10);

  const fullMask =
    prefixLength === 0
      ? 0n
      : ((1n << 128n) - 1n) & ~((1n << BigInt(128 - prefixLength)) - 1n);

  return (ipv6ToBigInt(ip) & fullMask) === (ipv6ToBigInt(networkAddress) & fullMask);
}

/**
 * Returns true when `ip` falls inside `cidr`.
 * Delegates to `matchesIpv6Cidr` for IPv6 addresses and CIDRs, and to
 * `matchesIpv4Cidr` for IPv4 addresses and CIDRs.
 */
export function matchesCidr(ip: string, cidr: string): boolean {
  if (ip.includes(":") || cidr.includes(":")) {
    return matchesIpv6Cidr(ip, cidr);
  }
  return matchesIpv4Cidr(ip, cidr);
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
      res.status(HttpStatus.FORBIDDEN).json(
        ErrorResponseFactory.forbidden("Your IP address is not permitted to access this resource"),
      );
      return;
    }

    if (config.allow && !matchesAny(ip, config.allow)) {
      res.status(HttpStatus.FORBIDDEN).json(
        ErrorResponseFactory.forbidden("Your IP address is not permitted to access this resource"),
      );
      return;
    }

    next();
  };
}
