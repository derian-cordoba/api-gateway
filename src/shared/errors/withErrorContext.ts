import { logger } from "../../apps/api-gateway/logger";
import { toError } from "./toError";

export type ErrorContextOptions<Exception extends Error = Error> = {
  message?: string;
  createException?: (cause: unknown) => Exception;
};

export async function withErrorContext<Result, Exception extends Error = Error>(
  fn: () => Result,
  options: ErrorContextOptions<Exception> = {},
): Promise<Awaited<Result>> {
  try {
    return await fn();
  } catch (cause) {
    if (options.createException) {
      const exception = options.createException(cause);
      attachCause(exception, cause);
      throw exception;
    }

    const error = toError(cause);
    if (options.message === undefined) throw error;

    throw new Error(options.message, { cause });
  }
}

function attachCause(exception: Error, cause: unknown): void {
  if (exception === cause) return;

  try {
    if (exception.cause !== undefined) return;

    const descriptor = Object.getOwnPropertyDescriptor(exception, "cause");
    if (descriptor && !descriptor.configurable) {
      if ("value" in descriptor && descriptor.writable) {
        Object.defineProperty(exception, "cause", { value: cause });
      }
      return;
    }

    if (!descriptor && !Object.isExtensible(exception)) return;

    Object.defineProperty(exception, "cause", {
      value: cause,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    logger.warn({ exception, cause }, "Failed to attach cause to exception");
  }
}
