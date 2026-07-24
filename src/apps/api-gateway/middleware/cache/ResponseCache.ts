import type { CacheStore } from "./CacheStore";
import { MemoryCacheStore } from "./MemoryCacheStore";
import { appEnv } from "../../config/app-env";

export type CacheEntry = {
  status: number;
  headers: Record<string, string | string[]>;
  body: Buffer;
  /**
   * Absolute timestamp after which the entry is considered stale.
   * When stale-while-revalidate is configured, the entry stays in the store
   * until `expiresAt` (which covers `ttl + staleWhileRevalidateMs`), and
   * `freshUntil` marks the boundary between fresh and stale.
   */
  expiresAt: number;
  /**
   * Absolute timestamp after which the response is considered stale but may
   * still be served under stale-while-revalidate. Equals `expiresAt` when SWR
   * is not configured.
   */
  readonly freshUntil: number;
  /** Timestamp set when a background refresh is in flight, preventing concurrent refreshes. */
  readonly refreshingAt?: number;
};

export type CacheOptions = {
  ttl: number;
  methods?: string[];
  statusCodes?: number[];
  /** Injectable storage backend. Defaults to `MemoryCacheStore`. */
  store?: CacheStore<CacheEntry>;
  /**
   * When set, responses past their TTL but within `ttl + staleWhileRevalidateMs`
   * are served immediately while a background refresh is triggered.
   */
  staleWhileRevalidateMs?: number;
};

export type CacheEntryWithStaleness = {
  readonly entry: CacheEntry;
  readonly isStale: boolean;
};

/**
 * Coordinates cache policy (TTL, cacheable methods/status-codes) and delegates
 * storage to a pluggable `CacheStore`.
 *
 * The storage backend is separated so callers can swap in a Redis- or
 * Memcached-backed implementation without changing any consumer code.
 */
export class ResponseCache {
  private readonly ttl: number;
  private readonly methods: Set<string>;
  private readonly statusCodes: Set<number>;
  private readonly store: CacheStore<CacheEntry>;
  private readonly staleWhileRevalidateMs: number | undefined;

  constructor(options: CacheOptions) {
    this.ttl = options.ttl;
    this.methods = new Set(
      (options.methods ?? appEnv.proxy.cacheDefaultMethods).map((method) => method.toUpperCase()),
    );
    this.statusCodes = new Set(options.statusCodes ?? appEnv.proxy.cacheDefaultStatusCodes);
    this.store = options.store ?? new MemoryCacheStore();
    this.staleWhileRevalidateMs = options.staleWhileRevalidateMs;
  }

  isCacheable(method: string, statusCode: number): boolean {
    return this.methods.has(method.toUpperCase()) && this.statusCodes.has(statusCode);
  }

  get(key: string): CacheEntry | null {
    return this.store.get(key);
  }

  /**
   * Returns the entry along with a staleness flag, honouring the
   * stale-while-revalidate window when configured.
   *
   * - No entry → null
   * - Within TTL (fresh) → `{ entry, isStale: false }`
   * - Past TTL but within `ttl + staleWhileRevalidateMs` → `{ entry, isStale: true }`
   * - Truly expired → null
   *
   * When SWR is configured, entries are stored with `expiresAt` set to
   * `ttl + staleWhileRevalidateMs` so the store's lazy eviction does not
   * discard them during the stale window. `freshUntil` marks the TTL boundary.
   */
  getWithStaleness(key: string): CacheEntryWithStaleness | null {
    const entry = this.store.get(key);
    if (entry === null) return null;

    const currentTime = Date.now();

    if (currentTime <= entry.freshUntil) {
      return { entry, isStale: false };
    }

    // Entry is past its TTL. It is still in the store because expiresAt was
    // extended to cover the SWR window. Serve it as stale.
    return { entry, isStale: true };
  }

  /**
   * Marks the entry at `key` as currently being refreshed to prevent
   * concurrent background refreshes. Callers should check `entry.refreshingAt`
   * before starting a background fetch.
   */
  markRefreshing(key: string): void {
    const entry = this.store.get(key);
    if (entry !== null) {
      this.store.set(key, { ...entry, refreshingAt: Date.now() });
    }
  }

  set(key: string, entry: Omit<CacheEntry, "expiresAt" | "freshUntil" | "refreshingAt">): void {
    const freshUntil = Date.now() + this.ttl;
    const expiresAt = freshUntil + (this.staleWhileRevalidateMs ?? 0);
    this.store.set(key, { ...entry, freshUntil, expiresAt });
  }

  /** Returns the number of currently valid (non-expired) entries. */
  size(): number {
    return this.store.size();
  }

  clear(): void {
    this.store.clear();
  }
}
