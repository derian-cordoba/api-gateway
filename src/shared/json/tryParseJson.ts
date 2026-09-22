import { toError } from "../errors/toError";

export type JsonParseResult =
  { success: true; value: unknown } | { success: false; error: Error };

export function tryParseJson(input: string): JsonParseResult {
  try {
    return { success: true, value: JSON.parse(input) as unknown };
  } catch (cause) {
    return { success: false, error: toError(cause) };
  }
}
