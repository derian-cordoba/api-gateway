export const DEFAULT_EVENT_LIMIT = 50;
export const MAX_EVENT_LIMIT = 100;
export const EVENT_LIMIT_OPTIONS = [10, 25, 50, 100] as const;

export function isValidEventLimit(limit: number): boolean {
  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_EVENT_LIMIT;
}
