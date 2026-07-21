import { StatusCodes as HttpStatus } from "http-status-codes";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type { CircuitBreaker } from "../../middleware/circuit-breaker/CircuitBreaker";
import type { ProxyEventPlugin } from "./ProxyEventPlugin";

/**
 * Feeds upstream outcomes back into a CircuitBreaker instance:
 *  - proxyRes  — classifies HTTP responses as success (2xx–4xx) or failure (5xx)
 *  - onError   — classifies network-level errors as failures and sends 502
 *                when no prior handler has already written a response
 */
export class CircuitBreakerPlugin implements ProxyEventPlugin {
  constructor(private readonly breaker: CircuitBreaker) {}

  onProxyRes(proxyRes: IncomingMessage): void {
    if (proxyRes.statusCode && proxyRes.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.breaker.recordFailure();
    } else {
      this.breaker.recordSuccess();
    }
  }

  onError(_err: Error, _req: IncomingMessage, res: ServerResponse | Socket): void {
    this.breaker.recordFailure();

    if ("headersSent" in res && !res.headersSent) {
      res.writeHead(HttpStatus.BAD_GATEWAY, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad Gateway", message: "Upstream service is unavailable" }));
    }
  }
}
