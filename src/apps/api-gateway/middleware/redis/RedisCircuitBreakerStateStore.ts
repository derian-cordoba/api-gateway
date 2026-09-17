import type { CircuitBreakerSnapshot } from "../circuit-breaker/CircuitBreakerStateStore";
import { CircuitState } from "../circuit-breaker/CircuitBreaker";

/**
 * Minimal Redis client interface required by RedisCircuitBreakerStateStore.
 * Compatible with ioredis and node-redis clients — users install the Redis
 * package of their choice separately; no hard dependency is introduced here.
 */
export interface RedisCircuitBreakerClientAdapter {
  hgetall(key: string): Promise<Record<string, string> | null>;
  hmset(key: string, fields: Record<string, string>): Promise<unknown>;
  expire(key: string, seconds: number): Promise<number>;
  del(...keys: string[]): Promise<number>;
}

/**
 * Internal shape of the Redis hash fields used to persist a snapshot.
 * All values are stored as strings because Redis hash fields are strings.
 * The index signature satisfies `Record<string, string>` so instances can be
 * passed directly to `hmset`.
 */
interface SnapshotHashFields extends Record<string, string> {
  state: string;
  failureCount: string;
  successCount: string;
  nextAttempt: string;
}

/**
 * Async `CircuitBreakerStateStore`-compatible interface whose methods return
 * `Promise`s.
 *
 * The built-in `CircuitBreakerStateStore` interface declares synchronous
 * `load` and `save` signatures. Because Redis I/O is inherently asynchronous
 * this store cannot implement that interface directly without deceiving the
 * type-checker. Instead it exposes the same method names with `Promise`-
 * wrapped return types. Callers must `await` every call.
 */
export interface AsyncCircuitBreakerStateStore {
  load(key: string): Promise<CircuitBreakerSnapshot | null>;
  save(key: string, snapshot: CircuitBreakerSnapshot): Promise<void>;
  deleteSnapshot(key: string): Promise<void>;
}

/**
 * Redis-backed implementation of `AsyncCircuitBreakerStateStore`.
 *
 * Each circuit breaker key is stored as a Redis hash (HSET / HGETALL) so all
 * fields for a given upstream are kept in one Redis key. An `EXPIRE` TTL is
 * applied on every write so stale circuit state is automatically evicted after
 * a configurable idle period (default: 24 hours).
 *
 * The `CircuitBreakerStateStore` interface declares synchronous `load`/`save`
 * signatures, so this class implements the async-compatible
 * `AsyncCircuitBreakerStateStore` supertype instead. Callers must `await`
 * these methods.
 *
 * @example
 * ```ts
 * import Redis from "ioredis";
 * const store = new RedisCircuitBreakerStateStore(new Redis(), "cb:", 86400);
 * const snapshot = await store.load("https://api.example.com");
 * ```
 */
export class RedisCircuitBreakerStateStore implements AsyncCircuitBreakerStateStore {
  constructor(
    private readonly client: RedisCircuitBreakerClientAdapter,
    private readonly keyPrefix: string = "cb:",
    private readonly ttlSeconds: number = 86400,
  ) {}

  /**
   * Load the latest state snapshot for the given circuit key from Redis.
   *
   * Returns `null` when no snapshot exists (the circuit will start CLOSED).
   * All numeric fields stored as strings in the Redis hash are parsed back to
   * numbers; the `state` field is cast to `CircuitState`.
   */
  async load(key: string): Promise<CircuitBreakerSnapshot | null> {
    const hashFields = await this.client.hgetall(this.prefixedKey(key));

    if (hashFields === null) {
      return null;
    }

    // Guard against an empty hash (key exists but has no fields).
    const { state, failureCount, successCount, nextAttempt } = hashFields as Partial<SnapshotHashFields>;

    if (!state || !failureCount || !successCount || !nextAttempt) {
      return null;
    }

    return {
      state: state as CircuitState,
      failureCount: Number(failureCount),
      successCount: Number(successCount),
      nextAttempt: Number(nextAttempt),
    };
  }

  /**
   * Persist a state snapshot to Redis.
   *
   * All numeric values are serialized as strings to satisfy the Redis hash
   * field requirement. A TTL is (re-)applied on every write so idle circuit
   * keys are evicted automatically.
   */
  async save(key: string, snapshot: CircuitBreakerSnapshot): Promise<void> {
    const prefixedKey = this.prefixedKey(key);

    const hashFields: SnapshotHashFields = {
      state: snapshot.state,
      failureCount: String(snapshot.failureCount),
      successCount: String(snapshot.successCount),
      nextAttempt: String(snapshot.nextAttempt),
    };

    await this.client.hmset(prefixedKey, hashFields);
    await this.client.expire(prefixedKey, this.ttlSeconds);
  }

  /**
   * Remove the persisted snapshot for the given circuit key.
   *
   * After deletion the circuit breaker will start fresh from CLOSED state on
   * the next process initialisation.
   */
  async deleteSnapshot(key: string): Promise<void> {
    await this.client.del(this.prefixedKey(key));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private prefixedKey(key: string): string {
    return this.keyPrefix + key;
  }
}
