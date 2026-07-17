import type { RequestHandler, Request, Response, NextFunction } from "express";
import type { ResponseCache } from "./ResponseCache";

/**
 * Headers managed by the transport layer that must NOT be stored in the cache
 * or forwarded from cached entries, as they are specific to the original
 * encoding/framing and will be set correctly by the current response stack.
 */
const SKIP_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

/**
 * Returns middleware that serves responses from `cache` on hit, and
 * intercepts upstream responses to populate the cache on miss.
 *
 * Cache key: `METHOD:ORIGINAL_URL` (e.g. `GET:/api/users?q=x`)
 *
 * Body capture: intercepts `res.write` and `res.end` AFTER the compression
 * middleware has already wrapped them, so captured bytes are pre-compression
 * (plain JSON/text). On HIT the body is re-served through the same compression
 * stack, which re-encodes it correctly.
 */
export function createCacheMiddleware(cache: ResponseCache): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    const key = `${method}:${req.originalUrl ?? req.url}`;

    // Cache HIT — serve stored response immediately
    const cached = cache.get(key);
    if (cached) {
      for (const [header, value] of Object.entries(cached.headers)) {
        res.setHeader(header, value);
      }
      res.setHeader("X-Cache", "HIT");
      res.status(cached.status).end(cached.body);
      return;
    }

    // Cache MISS — set header immediately (before any write flushes headers)
    // and intercept write/end to capture the pre-compression body for storage.
    res.setHeader("X-Cache", "MISS");

    const chunks: Buffer[] = [];

    const origWrite = res.write.bind(res) as (chunk: unknown, ...args: unknown[]) => boolean;
    const origEnd = res.end.bind(res) as (...args: unknown[]) => Response;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).write = (chunk: unknown, ...args: unknown[]): boolean => {
      if (chunk != null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }
      return origWrite(chunk, ...args);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).end = (chunk: unknown, ...args: unknown[]): Response => {
      if (chunk != null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      }

      const status = res.statusCode;

      if (cache.isCacheable(method, status)) {
        const body = Buffer.concat(chunks);
        const headers: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(res.getHeaders())) {
          if (v !== undefined && !SKIP_HEADERS.has(k.toLowerCase())) {
            headers[k] = v as string | string[];
          }
        }
        cache.set(key, { status, headers, body });
      }

      return origEnd(chunk, ...args);
    };

    next();
  };
}
