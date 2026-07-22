/**
 * Thrown by `RetryExecutor` when all retry attempts have been exhausted
 * without a successful upstream response.
 */
export class RetryExhaustedException extends Error {
  constructor(
    public readonly lastStatus: number,
    public readonly cause?: Error,
  ) {
    super("All retry attempts exhausted");
    this.name = "RetryExhaustedException";
  }
}
