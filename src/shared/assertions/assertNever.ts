export function assertNever(value: never, context = "value"): never {
  throw new Error(`Unhandled ${context}: ${String(value)}`);
}
