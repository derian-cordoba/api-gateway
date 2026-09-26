export type HttpErrorKind =
  "configuration" | "network" | "timeout" | "aborted" | "http" | "decode";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly kind: HttpErrorKind,
    readonly status?: number,
    readonly payload?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HttpError";
  }
}
