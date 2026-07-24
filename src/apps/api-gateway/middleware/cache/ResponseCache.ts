import type { CacheStore } from "./CacheStore";
import { MemoryCacheStore } from "./MemoryCacheStore";
import { appEnv } from "../../config/app-env";

export type CacheEntry = {
  status: number;
  headers: Record<string, string | string[]>;
  body: Buffer;
  expiresAt: number;
};

export type CacheOptions = {
  ttl: number;
  methods?: string[];
  statusCodes?: number[];
  /** Injectable storage backend. Defaults to `MemoryCacheStore`. */
  store?: CacheStore<CacheEntry>;
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

  constructor(options: CacheOptions) {
    this.ttl = options.ttl;
    this.methods = new Set(
      (options.methods ?? appEnv.proxy.cacheDefaultMethods).map((method) => method.toUpperCase()),
    );
    this.statusCodes = new Set(options.statusCodes ?? appEnv.proxy.cacheDefaultStatusCodes);
    this.store = options.store ?? new MemoryCacheStore();
  }

  isCacheable(method: string, statusCode: number): boolean {
    return this.methods.has(method.toUpperCase()) && this.statusCodes.has(statusCode);
  }

  get(key: string): CacheEntry | null {
    return this.store.get(key);
  }

  set(key: string, entry: Omit<CacheEntry, "expiresAt">): void {
    this.store.set(key, { ...entry, expiresAt: Date.now() + this.ttl });
  }

  /** Returns the number of currently valid (non-expired) entries. */
  size(): number {
    return this.store.size();
  }

  clear(): void {
    this.store.clear();
  }
}
