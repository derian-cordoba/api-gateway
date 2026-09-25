import type { RequestHandler, Request, Response, NextFunction } from "express";
import type { OutgoingHttpHeader } from "node:http";
import type { CacheEntry, ResponseCache } from "./ResponseCache";
import { createHash } from "node:crypto";

// ── Concrete types for response method interception ───────────────────────────

/** Matches the concrete chunk types accepted by Node's `OutgoingMessage.write/end`. */
type WriteChunk = string | Uint8Array;
type WriteCallback = (err?: Error | null) => void;
type EndCallback = () => void;

/**
 * A widened Response interface that makes `write` and `end` directly
 * assignable with concrete, fully-typed signatures.
 *
 * `as unknown as MutableResponse` is used exactly once — inside
 * `ResponseBodyInterceptor` — so no `any` leaks into observable types.
 */
interface MutableResponse extends Omit<Response, "write" | "end"> {
  write(
    chunk: WriteChunk | null | undefined,
    encodingOrCallback?: BufferEncoding | WriteCallback,
    callback?: WriteCallback,
  ): boolean;

  end(
    chunk?: WriteChunk | null,
    encodingOrCallback?: BufferEncoding | EndCallback,
    callback?: EndCallback,
  ): this;
}

// ── Transport headers that must not be stored or re-forwarded ─────────────────

/**
 * Headers managed by the transport layer that must NOT be stored in the
 * cache or forwarded from cached entries, as they are specific to the
 * original encoding/framing and will be set correctly by the current
 * response stack.
 */
const SKIP_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

// ── ResponseBodyInterceptor ───────────────────────────────────────────────────

/**
 * Patches `res.write` and `res.end` with concrete-typed overrides to capture
 * the pre-compression response body as it flows through Express.
 *
 * Single responsibility: body capture only. What to do with the captured
 * body is delegated to the `onEnd` callback provided by the caller.
 *
 * The cast `as unknown as MutableResponse` is localised here and never
 * escapes — all internal method calls use the fully-typed `MutableResponse`
 * interface.
 */
class ResponseBodyInterceptor {
  private readonly chunks: Buffer[] = [];

  constructor(res: Response, onEnd: (body: Buffer) => void) {
    const mutable = res as unknown as MutableResponse;
    const origWrite = mutable.write.bind(mutable);
    const origEnd = mutable.end.bind(mutable);

    mutable.write = (chunk, encodingOrCallback?, callback?): boolean => {
      this.collect(chunk);
      return origWrite(chunk, encodingOrCallback, callback);
    };

    mutable.end = (chunk?, encodingOrCallback?, callback?): MutableResponse => {
      this.collect(chunk);
      onEnd(Buffer.concat(this.chunks));
      return origEnd(chunk, encodingOrCallback, callback);
    };
  }

  private collect(chunk: WriteChunk | null | undefined): void {
    if (chunk == null) return;
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function serveCachedResponse(entry: CacheEntry, res: Response, xCacheValue: string): void {
  for (const [header, value] of Object.entries(entry.headers)) {
    res.setHeader(header, value);
  }
  res.setHeader("X-Cache", xCacheValue);
  res.status(entry.status).end(entry.body);
}

function extractForwardableHeaders(res: Response): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};
  for (const [key, rawValue] of Object.entries(res.getHeaders())) {
    if (rawValue === undefined || SKIP_HEADERS.has(key.toLowerCase())) continue;
    headers[key] =
      typeof rawValue === "number"
        ? String(rawValue)
        : (rawValue as Exclude<OutgoingHttpHeader, number | undefined>);
  }
  return headers;
}

function cacheIdentity(req: Request): string {
  const authorization = req.headers.authorization;
  const cookie = req.headers.cookie;
  if (!authorization && !cookie) return "public";
  return createHash("sha256")
    .update(`${authorization ?? ""}\n${cookie ?? ""}`)
    .digest("hex")
    .slice(0, 24);
}

function shouldStoreResponse(res: Response): boolean {
  const cacheControl = String(res.getHeader("cache-control") ?? "")
    .toLowerCase();

  return !cacheControl
    .split(",")
    .some((directive) => {
      const normalized = directive.trim();
      return normalized === "private"
        || normalized.startsWith("private=")
        || normalized === "no-store"
        || normalized.startsWith("no-store=");
    });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns middleware that serves responses from `cache` on hit, and
 * intercepts upstream responses to populate the cache on miss.
 *
 * Cache key: method, original URL, and a short digest of Authorization/cookie
 * identity. Public requests share entries; authenticated requests do not share
 * responses across different credentials.
 *
 * Body capture: intercepts `res.write` and `res.end` AFTER the compression
 * middleware has already wrapped them, so captured bytes are pre-compression
 * (plain JSON/text). On HIT the body is re-served through the same compression
 * stack, which re-encodes it correctly.
 *
 * Stale-While-Revalidate (SWR):
 * - First stale hit: serve stale entry with `X-Cache: STALE` and mark the
 *   entry as refreshing so subsequent requests know a refresh is needed.
 * - Second stale hit (refreshingAt is set): bypass the cache, go to upstream,
 *   and let the interceptor store the fresh entry. This prevents multiple
 *   concurrent upstream refreshes.
 */
export function createCacheMiddleware(cache: ResponseCache): RequestHandler {
  const refreshingKeys = new Set<string>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    const key = `${method}:${req.originalUrl ?? req.url}:identity=${cacheIdentity(req)}`;

    const result = cache.getWithStaleness(key);

    if (result === null) {
      // Cache miss — go to upstream and populate the cache on the way back.
      res.setHeader("X-Cache", "MISS");

      new ResponseBodyInterceptor(res, (body) => {
        if (cache.isCacheable(method, res.statusCode) && shouldStoreResponse(res)) {
          cache.set(key, {
            status: res.statusCode,
            headers: extractForwardableHeaders(res),
            body,
          });
        }
      });

      next();
      return;
    }

    if (!result.isStale) {
      // Fresh cache hit — serve immediately.
      serveCachedResponse(result.entry, res, "HIT");
      return;
    }

    // Stale entry within the stale-while-revalidate window.
    if (result.entry.refreshingAt === undefined) {
      // First stale hit: serve the stale response and mark the entry so the
      // next request triggers an upstream refresh.
      serveCachedResponse(result.entry, res, "STALE");
      cache.markRefreshing(key);
      return;
    }

    if (refreshingKeys.has(key)) {
      serveCachedResponse(result.entry, res, "STALE");
      return;
    }

    refreshingKeys.add(key);
    const clearRefreshing = (): void => {
      refreshingKeys.delete(key);
    };
    res.once("finish", clearRefreshing);
    res.once("close", clearRefreshing);

    // Subsequent stale hit with a refresh already flagged: bypass the cache
    // and let this request go to upstream to refresh the stored entry.
    res.setHeader("X-Cache", "MISS");

    new ResponseBodyInterceptor(res, (body) => {
      if (cache.isCacheable(method, res.statusCode) && shouldStoreResponse(res)) {
        cache.set(key, {
          status: res.statusCode,
          headers: extractForwardableHeaders(res),
          body,
        });
      }
      clearRefreshing();
    });

    next();
  };
}
