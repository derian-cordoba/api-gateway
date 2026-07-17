const DEFAULT_METHODS = ["GET", "HEAD"];
const DEFAULT_STATUS_CODES = [200, 203, 204];

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
};

export class ResponseCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly ttl: number;
  private readonly methods: Set<string>;
  private readonly statusCodes: Set<number>;

  constructor(options: CacheOptions) {
    this.ttl = options.ttl;
    this.methods = new Set((options.methods ?? DEFAULT_METHODS).map((method) => method.toUpperCase()));
    this.statusCodes = new Set(options.statusCodes ?? DEFAULT_STATUS_CODES);
  }

  isCacheable(method: string, statusCode: number): boolean {
    return this.methods.has(method.toUpperCase()) && this.statusCodes.has(statusCode);
  }

  get(key: string): CacheEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, entry: Omit<CacheEntry, "expiresAt">): void {
    this.store.set(key, { ...entry, expiresAt: Date.now() + this.ttl });
  }

  /** Returns the number of currently valid (non-expired) entries. */
  size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }
}
