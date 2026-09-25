import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type { LoadBalancer } from "../../middleware/load-balancer/LoadBalancer";
import type { ProxyEventPlugin } from "./ProxyEventPlugin";

/**
 * Decrements the active-connection count on the load balancer when a
 * proxied request completes (success or error).
 *
 * Only has effect when the load balancer is using the "least-connections"
 * strategy; all other strategies ignore `onConnectionClosed`.
 */
export class LoadBalancerPlugin implements ProxyEventPlugin {
  constructor(private readonly balancer: LoadBalancer) { }

  onProxyRes(proxyRes: IncomingMessage, req: IncomingMessage): void {
    if (proxyRes.statusCode && proxyRes.statusCode >= 500) {
      this.balancer.recordFailure(req);
    } else {
      this.balancer.recordSuccess(req);
    }
    this.balancer.onConnectionClosed(req);
  }

  onError(_err: Error, req: IncomingMessage, _res: ServerResponse | Socket): void {
    this.balancer.recordFailure(req);
    this.balancer.onConnectionClosed(req);
  }
}
