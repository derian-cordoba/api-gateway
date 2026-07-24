import { StatusCodes } from "http-status-codes";

/**
 * Machine-readable error code included in every gateway error response.
 * Lets clients distinguish error categories without parsing the human-readable
 * `error` string.
 */
export type GatewayErrorCode = keyof typeof StatusCodes | "CIRCUIT_OPEN" | "UPSTREAM_UNAVAILABLE";

/**
 * Canonical error response body emitted by the gateway on all 4xx/5xx
 * responses it generates itself (not proxied from upstream).
 */
export type GatewayErrorResponse = {
  readonly error: string;
  readonly message: string;
  readonly code: GatewayErrorCode;
};

/**
 * Produces consistent `GatewayErrorResponse` objects for every error
 * condition the gateway can generate. All middleware must use these factory
 * methods instead of constructing inline `{ error, message }` literals.
 */
export class ErrorResponseFactory {
  static unauthorized(message: string): GatewayErrorResponse {
    return { error: "Unauthorized", message, code: "UNAUTHORIZED" };
  }

  static forbidden(message: string): GatewayErrorResponse {
    return { error: "Forbidden", message, code: "FORBIDDEN" };
  }

  static circuitOpen(): GatewayErrorResponse {
    return {
      error: "Service Unavailable",
      message: "Circuit breaker open — upstream is not responding",
      code: "CIRCUIT_OPEN",
    };
  }

  static badGateway(message: string): GatewayErrorResponse {
    return { error: "Bad Gateway", message, code: "BAD_GATEWAY" };
  }

  static upstreamUnavailable(): GatewayErrorResponse {
    return {
      error: "Bad Gateway",
      message: "Upstream service is unavailable",
      code: "UPSTREAM_UNAVAILABLE",
    };
  }

  static gatewayTimeout(timeoutMs: number): GatewayErrorResponse {
    return {
      error: "Gateway Timeout",
      message: `Upstream did not respond within ${timeoutMs}ms`,
      code: "GATEWAY_TIMEOUT",
    };
  }
}
