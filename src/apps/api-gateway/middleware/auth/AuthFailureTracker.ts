type FailureWindow = {
  count: number;
  resetAt: number;
};

/**
 * Tracks per-key authentication failure counts within a rolling time window.
 *
 * Stored entirely in-process. Keys are typically client IP addresses.
 * Entries are cleaned up lazily when `isBlocked` or `recordFailure` is called
 * after the window has elapsed.
 */
export class AuthFailureTracker {
  private readonly windowsByKey = new Map<string, FailureWindow>();
  private readonly evictionTimer: ReturnType<typeof setInterval> | null;

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    evictionIntervalMs?: number,
  ) {
    if (evictionIntervalMs !== undefined && evictionIntervalMs > 0) {
      this.evictionTimer = setInterval(() => this.evictExpired(), evictionIntervalMs).unref();
    } else {
      this.evictionTimer = null;
    }
  }

  isBlocked(key: string): boolean {
    const window = this.windowsByKey.get(key);
    if (window === undefined) return false;

    if (Date.now() >= window.resetAt) {
      this.windowsByKey.delete(key);
      return false;
    }

    return window.count >= this.maxFailures;
  }

  dispose(): void {
    if (this.evictionTimer !== null) {
      clearInterval(this.evictionTimer);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, window] of this.windowsByKey.entries()) {
      if (now >= window.resetAt) {
        this.windowsByKey.delete(key);
      }
    }
  }

  recordFailure(key: string): void {
    const now = Date.now();
    const existing = this.windowsByKey.get(key);

    if (existing === undefined || now >= existing.resetAt) {
      this.windowsByKey.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    existing.count++;
  }
}
