export class ConfigurationConflictError extends Error {
  constructor(
    readonly expectedRevision: string,
    readonly currentRevision: string,
  ) {
    super("The route configuration changed after it was opened.");
    this.name = "ConfigurationConflictError";
  }
}

export class RouteStorageError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unavailable"
      | "schema"
      | "uninitialized"
      | "not-found"
      | "precondition"
      | "configuration",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RouteStorageError";
  }
}
