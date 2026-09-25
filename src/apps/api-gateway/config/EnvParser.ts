/**
 * Stateless helpers for parsing raw environment-variable strings into typed
 * values. Each method falls back to the provided default when the raw input
 * is absent, empty, or cannot be coerced to the expected type/shape.
 */
export class EnvParser {
  static proxyTrust(raw: string | undefined, fallback: boolean | number): boolean | number {
    if (!raw) {
      return fallback;
    }

    const normalized = raw.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }

    const hops = Number(normalized);
    return Number.isInteger(hops) && hops >= 0 ? hops : fallback;
  }

  /**
   * Parses a positive integer. Returns `fallback` when `raw` is absent,
   * non-numeric, zero, or negative.
   */
  static positiveInt(raw: string | undefined, fallback: number): number {
    const number = Number(raw);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }

  /**
   * Parses a positive finite float. Returns `fallback` when `raw` is absent,
   * non-numeric, zero, or negative.
   */
  static positiveFloat(raw: string | undefined, fallback: number): number {
    const number = Number(raw);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  /**
   * Parses a comma-separated list of positive finite numbers (histogram
   * bucket boundaries). Returns `fallback` when `raw` is absent or yields no
   * valid entries.
   */
  static positiveBuckets(raw: string | undefined, fallback: number[]): number[] {
    if (!raw) return fallback;

    const buckets = raw
      .split(",")
      .map((segment) => Number(segment.trim()))
      .filter((number) => Number.isFinite(number) && number > 0);

    return buckets.length > 0 ? buckets : fallback;
  }

  /**
   * Parses a comma-separated list of HTTP method strings, uppercased.
   * Returns `fallback` when `raw` is absent or yields no non-empty entries.
   */
  static httpMethods(raw: string | undefined, fallback: string[]): string[] {
    if (!raw) return fallback;

    const methods = raw
      .split(",")
      .map((segment) => segment.trim().toUpperCase())
      .filter(Boolean);

    return methods.length > 0 ? methods : fallback;
  }

  /**
   * Parses a comma-separated list of HTTP status codes (100–599).
   * Returns `fallback` when `raw` is absent or yields no valid codes.
   */
  static httpStatusCodes(raw: string | undefined, fallback: number[]): number[] {
    if (!raw) return fallback;

    const codes = raw
      .split(",")
      .map((segment) => Number(segment.trim()))
      .filter((number) => Number.isInteger(number) && number >= 100 && number <= 599);

    return codes.length > 0 ? codes : fallback;
  }
}
