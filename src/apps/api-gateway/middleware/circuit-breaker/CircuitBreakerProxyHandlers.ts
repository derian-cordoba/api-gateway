import { StatusCodes as HttpStatus } from "http-status-codes";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type { Options } from "http-proxy-middleware";
import type { CircuitBreaker } from "./CircuitBreaker";

type ProxyOnHandlers = NonNullable<Options["on"]>;

/**
 * Encapsulates the http-proxy-middleware event handlers that feed upstream
 * outcomes back into a CircuitBreaker instance.
 *
 * Responsibilities:
 *  - proxyRes  — classifies upstream HTTP responses as success or failure
 *  - error     — classifies network-level errors as failures and owns the
 *                502 response when no prior handler has sent one
 */
export class CircuitBreakerProxyHandlers {
  constructor(private readonly breaker: CircuitBreaker) {
    //
  }

  readonly proxyRes = (proxyRes: IncomingMessage): void => {
    if (proxyRes.statusCode && proxyRes.statusCode >= 500) {
      this.breaker.recordFailure();
    } else {
      this.breaker.recordSuccess();
    }
  };

  readonly error = (_err: Error, _req: IncomingMessage, res: ServerResponse | Socket): void => {
    this.breaker.recordFailure();

    if ("headersSent" in res && !res.headersSent) {
      res.writeHead(HttpStatus.BAD_GATEWAY, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad Gateway", message: "Upstream service is unavailable" }));
    }
  };

  toOnHandlers(): Pick<ProxyOnHandlers, "proxyRes" | "error"> {
    return { proxyRes: this.proxyRes, error: this.error };
  }
}
