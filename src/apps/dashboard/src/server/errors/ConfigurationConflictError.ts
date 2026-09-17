export class ConfigurationConflictError extends Error {
  constructor(
    readonly expectedRevision: string,
    readonly currentRevision: string,
  ) {
    super("The route configuration changed after it was opened.");
    this.name = "ConfigurationConflictError";
  }
}

