import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CircuitBreaker,
  CircuitState,
} from "../../../../src/apps/api-gateway/middleware/circuit-breaker/CircuitBreaker";

const CONFIG = { threshold: 3, timeout: 30_000, successThreshold: 1 };

/** Open the circuit by recording exactly `threshold` failures. */
function openBreaker(config = CONFIG): CircuitBreaker {
  const breaker = new CircuitBreaker(config, "/api");
  for (let i = 0; i < config.threshold; i++) breaker.recordFailure();
  return breaker;
}

/** Open and then immediately transition to HALF_OPEN by advancing past timeout. */
function halfOpenBreaker(config = CONFIG): CircuitBreaker {
  const breaker = openBreaker(config);
  vi.advanceTimersByTime(config.timeout);
  breaker.shouldReject(); // triggers OPEN → HALF_OPEN + sets probing=true
  return breaker;
}

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // MARK: Initial state

  describe("initial state", () => {
    it("starts in CLOSED state", () => {
      const breaker = new CircuitBreaker(CONFIG, "/api");
      expect(breaker.currentState).toBe(CircuitState.CLOSED);
    });

    it("shouldReject() returns false when CLOSED", () => {
      const breaker = new CircuitBreaker(CONFIG, "/api");
      expect(breaker.shouldReject()).toBe(false);
    });

    it("retryAfterSeconds() returns 0 when CLOSED", () => {
      const breaker = new CircuitBreaker(CONFIG, "/api");
      expect(breaker.retryAfterSeconds()).toBe(0);
    });
  });

  // MARK: CLOSED → OPEN

  describe("CLOSED → OPEN transition", () => {
    it("stays CLOSED while failures are below threshold", () => {
      const breaker = new CircuitBreaker(CONFIG, "/api");
      for (let i = 0; i < CONFIG.threshold - 1; i++) breaker.recordFailure();
      expect(breaker.currentState).toBe(CircuitState.CLOSED);
      expect(breaker.shouldReject()).toBe(false);
    });

    it("opens the circuit exactly at the failure threshold", () => {
      const breaker = openBreaker();
      expect(breaker.currentState).toBe(CircuitState.OPEN);
    });

    it("shouldReject() returns true once the circuit is OPEN", () => {
      const breaker = openBreaker();
      expect(breaker.shouldReject()).toBe(true);
    });

    it("recordSuccess() in CLOSED resets the failure counter", () => {
      const breaker = new CircuitBreaker(CONFIG, "/api");
      // Drive failures to one below threshold, then recover
      for (let i = 0; i < CONFIG.threshold - 1; i++) breaker.recordFailure();
      breaker.recordSuccess();
      // Now it takes another full `threshold` failures to open
      for (let i = 0; i < CONFIG.threshold - 1; i++) breaker.recordFailure();
      expect(breaker.currentState).toBe(CircuitState.CLOSED);
      breaker.recordFailure();
      expect(breaker.currentState).toBe(CircuitState.OPEN);
    });

    it("does not open prematurely with mixed successes and failures", () => {
      const breaker = new CircuitBreaker(CONFIG, "/api");
      breaker.recordFailure();
      breaker.recordSuccess(); // reset
      breaker.recordFailure();
      breaker.recordFailure();
      // Only 2 failures since last success
      expect(breaker.currentState).toBe(CircuitState.CLOSED);
    });
  });

  // MARK: OPEN → HALF_OPEN

  describe("OPEN → HALF_OPEN transition", () => {
    it("shouldReject() still returns true just before the timeout elapses", () => {
      const breaker = openBreaker();
      vi.advanceTimersByTime(CONFIG.timeout - 1);
      expect(breaker.shouldReject()).toBe(true);
    });

    it("transitions to HALF_OPEN once the timeout has elapsed", () => {
      const breaker = openBreaker();
      vi.advanceTimersByTime(CONFIG.timeout);
      breaker.shouldReject(); // triggers the transition
      expect(breaker.currentState).toBe(CircuitState.HALF_OPEN);
    });

    it("shouldReject() returns false for the first call after timeout (probe request)", () => {
      const breaker = openBreaker();
      vi.advanceTimersByTime(CONFIG.timeout);
      expect(breaker.shouldReject()).toBe(false);
    });

    it("only allows one probe at a time — subsequent HALF_OPEN calls return true", () => {
      const breaker = openBreaker();
      vi.advanceTimersByTime(CONFIG.timeout);
      breaker.shouldReject(); // probe allowed
      expect(breaker.shouldReject()).toBe(true);
      expect(breaker.shouldReject()).toBe(true);
    });

    it("retryAfterSeconds() returns remaining seconds in OPEN state", () => {
      const breaker = openBreaker({ threshold: 3, timeout: 30_000 });
      vi.advanceTimersByTime(10_000);
      expect(breaker.retryAfterSeconds()).toBe(20);
    });

    it("retryAfterSeconds() returns 0 once the timeout has fully elapsed", () => {
      const breaker = openBreaker({ threshold: 3, timeout: 30_000 });
      vi.advanceTimersByTime(30_000);
      expect(breaker.retryAfterSeconds()).toBe(0);
    });
  });

  // MARK: HALF_OPEN → CLOSED

  describe("HALF_OPEN → CLOSED transition", () => {
    it("closes the circuit after a single probe success (successThreshold=1)", () => {
      const breaker = halfOpenBreaker();
      breaker.recordSuccess();
      expect(breaker.currentState).toBe(CircuitState.CLOSED);
    });

    it("requires exactly successThreshold successes before closing (successThreshold=2)", () => {
      const config = { threshold: 3, timeout: 30_000, successThreshold: 2 };
      const breaker = halfOpenBreaker(config);

      breaker.recordSuccess();
      expect(breaker.currentState).toBe(CircuitState.HALF_OPEN); // not yet

      // Allow second probe
      expect(breaker.shouldReject()).toBe(false);
      breaker.recordSuccess();
      expect(breaker.currentState).toBe(CircuitState.CLOSED);
    });

    it("shouldReject() returns false after the circuit is closed", () => {
      const breaker = halfOpenBreaker();
      breaker.recordSuccess();
      expect(breaker.shouldReject()).toBe(false);
    });

    it("resets counters on close so the circuit can re-open from scratch", () => {
      const breaker = halfOpenBreaker();
      breaker.recordSuccess(); // CLOSED

      // Drive failures again
      for (let i = 0; i < CONFIG.threshold - 1; i++) breaker.recordFailure();
      expect(breaker.currentState).toBe(CircuitState.CLOSED);
      breaker.recordFailure();
      expect(breaker.currentState).toBe(CircuitState.OPEN);
    });
  });

  // MARK: HALF_OPEN → OPEN (probe fails)

  describe("HALF_OPEN → OPEN transition (probe failure)", () => {
    it("re-opens the circuit immediately when the probe fails", () => {
      const breaker = halfOpenBreaker();
      breaker.recordFailure();
      expect(breaker.currentState).toBe(CircuitState.OPEN);
    });

    it("shouldReject() returns true immediately after probe failure", () => {
      const breaker = halfOpenBreaker();
      breaker.recordFailure();
      expect(breaker.shouldReject()).toBe(true);
    });

    it("sets a fresh timeout after the probe failure re-opens the circuit", () => {
      const config = { threshold: 3, timeout: 30_000, successThreshold: 1 };
      const breaker = halfOpenBreaker(config);
      breaker.recordFailure(); // OPEN again with fresh timeout

      vi.advanceTimersByTime(config.timeout - 1);
      expect(breaker.shouldReject()).toBe(true); // still within timeout

      vi.advanceTimersByTime(1); // timeout elapsed
      expect(breaker.shouldReject()).toBe(false); // HALF_OPEN probe allowed again
    });

    it("clears the probing flag so the next probe cycle can proceed", () => {
      const breaker = halfOpenBreaker();
      breaker.recordFailure(); // back to OPEN
      vi.advanceTimersByTime(CONFIG.timeout);
      // Should allow exactly one probe again
      expect(breaker.shouldReject()).toBe(false); // probe
      expect(breaker.shouldReject()).toBe(true); // blocked
    });
  });
});
