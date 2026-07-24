import type { RequestKeyExtractor } from "./RequestKeyExtractor";
import { IpKeyExtractor } from "./IpKeyExtractor";
import { HeaderKeyExtractor } from "./HeaderKeyExtractor";
import { JwtClaimKeyExtractor } from "./JwtClaimKeyExtractor";
import { CookieKeyExtractor } from "./CookieKeyExtractor";
import { QueryParamKeyExtractor } from "./QueryParamKeyExtractor";

// ── Discriminated spec type ──────────────────────────────────────────────────

type IpSpec     = { readonly kind: "ip" };
type HeaderSpec = { readonly kind: "header"; readonly name: string };
type JwtSpec    = { readonly kind: "jwt";    readonly claim: string };
type CookieSpec = { readonly kind: "cookie"; readonly name: string };
type QuerySpec  = { readonly kind: "query";  readonly name: string };

type KeySpec = IpSpec | HeaderSpec | JwtSpec | CookieSpec | QuerySpec;

// ── Parser ───────────────────────────────────────────────────────────────────

function parseSpec(raw: string): KeySpec {
  if (raw === "ip") return { kind: "ip" };

  const colonIndex = raw.indexOf(":");
  if (colonIndex === -1) {
    throw new Error(`Invalid key extractor spec "${raw}": expected "ip", "header:<name>", "jwt:<claim>", "cookie:<name>", or "query:<name>"`);
  }

  const kind = raw.slice(0, colonIndex);
  const value = raw.slice(colonIndex + 1);

  switch (kind) {
    case "header": return { kind: "header", name: value };
    case "jwt":    return { kind: "jwt",    claim: value };
    case "cookie": return { kind: "cookie", name: value };
    case "query":  return { kind: "query",  name: value };
    default:
      throw new Error(`Unknown key source "${kind}": expected "header", "jwt", "cookie", or "query"`);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Parses a `keyBy` / `stickyKey` spec string and returns the corresponding
 * `RequestKeyExtractor` strategy.
 *
 * Valid formats:
 *  - `"ip"`              → `IpKeyExtractor`
 *  - `"header:<name>"`   → `HeaderKeyExtractor`
 *  - `"jwt:<claim>"`     → `JwtClaimKeyExtractor`
 *  - `"cookie:<name>"`   → `CookieKeyExtractor`
 *  - `"query:<name>"`    → `QueryParamKeyExtractor`
 */
export class RequestKeyExtractorFactory {
  static fromSpec(spec: string): RequestKeyExtractor {
    const parsed = parseSpec(spec);

    switch (parsed.kind) {
      case "ip":     return new IpKeyExtractor();
      case "header": return new HeaderKeyExtractor(parsed.name);
      case "jwt":    return new JwtClaimKeyExtractor(parsed.claim);
      case "cookie": return new CookieKeyExtractor(parsed.name);
      case "query":  return new QueryParamKeyExtractor(parsed.name);
    }
  }
}
