import type { IncomingHttpHeaders } from "node:http";

/**
 * Strips HTTP/1.1 hop-by-hop headers from an upstream response header map
 * before forwarding to the downstream client.
 *
 * Hop-by-hop headers describe the connection between two adjacent nodes and
 * must not be forwarded end-to-end (RFC 2616 §13.5.1).
 */
export class HopByHopHeaderFilter {
  private static readonly HOP_BY_HOP = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
  ]);

  static filter(headers: IncomingHttpHeaders): IncomingHttpHeaders {
    const result: IncomingHttpHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!HopByHopHeaderFilter.HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }
}
