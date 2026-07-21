/**
 * The JSON value type hierarchy — the concrete set of values that
 * `JSON.parse` can return. Using this instead of `unknown` or `any`
 * accurately describes data at the parsing boundary before Zod validation.
 */
export type JsonPrimitive = string | number | boolean | null;

// interface (not type alias) is required here: TypeScript resolves interfaces
// lazily, which allows the mutual recursion between JsonObject and JsonValue.
export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

/**
 * Contract for anything that can load raw (pre-validation) route
 * entries from an external source (file, env var, remote, etc.).
 *
 * Each entry is a `JsonObject` — a parsed JSON object whose shape
 * is not yet guaranteed. Callers must pass the result through
 * `validateRoutes()` before treating it as `Gateway[]`.
 */
export interface RouteSource {
  load(): Promise<JsonObject[]>;
}
