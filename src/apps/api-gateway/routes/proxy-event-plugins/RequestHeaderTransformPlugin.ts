import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
import type { HeaderTransform } from "../../types/headers";
import type { ProxyEventPlugin } from "./ProxyEventPlugin";

/**
 * Applies request-side header transforms to the outgoing proxy request.
 * Must run after `FixRequestBodyPlugin` so the request is fully initialised
 * before headers are mutated.
 */
export class RequestHeaderTransformPlugin implements ProxyEventPlugin {
  constructor(private readonly transform: HeaderTransform) {}

  onProxyReq(proxyReq: ClientRequest, _req: IncomingMessage, _res: ServerResponse): void {
    const { set, remove } = this.transform;

    if (set) {
      for (const [key, val] of Object.entries(set)) {
        proxyReq.setHeader(key, val);
      }
    }

    if (remove) {
      for (const key of remove) {
        proxyReq.removeHeader(key);
      }
    }
  }
}
