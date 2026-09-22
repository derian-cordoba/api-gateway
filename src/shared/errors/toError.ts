export function toError(cause: unknown): Error {
  if (cause instanceof Error) {
    return cause;
  }

  if (typeof cause === "string") {
    return new Error(cause, { cause });
  }

  let message: string | undefined;

  try {
    message = JSON.stringify(cause);
  } catch {
    // Fall through to string coercion.
  }

  if (message === undefined) {
    try {
      message = String(cause ?? "Unknown error");
    } catch {
      message = "Unknown error";
    }
  }

  return new Error(message, { cause });
}
