import type { IncomingMessage, ServerResponse } from "node:http";
import type { HeaderTransform } from "../../types/headers";
import type { ProxyEventPlugin } from "./ProxyEventPlugin";

/**
 * Applies response-side header transforms to the Express response before it
 * is flushed to the client.
 *
 * Should be the last plugin in the chain so it can override any headers set
 * by earlier plugins (e.g. circuit breaker, load balancer).
 */
export class ResponseHeaderTransformPlugin implements ProxyEventPlugin {
  constructor(private readonly transform: HeaderTransform) {}

  onProxyRes(proxyRes: IncomingMessage, _req: IncomingMessage, res: ServerResponse): void {
    const { set, remove } = this.transform;

    if (remove) {
      for (const key of remove) {
        // Delete from proxyRes.headers so http-proxy-middleware never forwards
        // them, then also call removeHeader in case they were set earlier.
        delete proxyRes.headers[key.toLowerCase()];
        res.removeHeader(key);
      }
    }

    if (set) {
      for (const [key, val] of Object.entries(set)) {
        res.setHeader(key, val);
      }
    }
  }
}
