import type { HealthCheckConfig } from "../../types/circuit-breaker";
import type { CircuitBreaker } from "./CircuitBreaker";
import { logger } from "../../logger";

const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

/**
 * Periodically pings a health-check URL and records the result on a
 * `CircuitBreaker`. This accelerates recovery: instead of waiting for real
 * traffic to act as probes in HALF_OPEN state, the prober actively tests
 * upstream availability while the circuit is OPEN.
 *
 * The underlying timer is `unref()`'d so it never prevents the process from
 * exiting in tests or during graceful shutdown.
 */
export class HealthProber {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly breaker: CircuitBreaker,
    private readonly config: HealthCheckConfig,
  ) {}

  /** Start probing. Safe to call multiple times — subsequent calls are no-ops. */
  start(): void {
    if (this.timer !== null) return;

    this.timer = setInterval(() => void this.probe(), this.config.intervalMs);

    // Unref so the interval does not prevent the process from exiting when
    // all other work is done (important for tests and graceful shutdown).
    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }

  /** Stop probing. Safe to call multiple times — subsequent calls are no-ops. */
  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async probe(): Promise<void> {
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;

    try {
      const signal = AbortSignal.timeout(timeoutMs);
      const response = await fetch(this.config.url, { method: "GET", signal });

      if (response.ok) {
        logger.debug({ url: this.config.url }, "Health probe succeeded");
        this.breaker.recordSuccess();
      } else {
        logger.debug({ url: this.config.url, status: response.status }, "Health probe returned non-2xx");
        this.breaker.recordFailure();
      }
    } catch (err) {
      logger.debug({ url: this.config.url, err }, "Health probe failed");
      this.breaker.recordFailure();
    }
  }
}
