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

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
  ) {}

  isBlocked(key: string): boolean {
    const window = this.windowsByKey.get(key);
    if (window === undefined) return false;

    if (Date.now() >= window.resetAt) {
      this.windowsByKey.delete(key);
      return false;
    }

    return window.count >= this.maxFailures;
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
