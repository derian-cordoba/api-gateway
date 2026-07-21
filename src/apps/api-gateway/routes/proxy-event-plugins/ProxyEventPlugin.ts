import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";

/**
 * Pluggable hook into http-proxy-middleware's lifecycle events.
 *
 * Each method is optional — implement only the events your plugin needs.
 * `ProxyHandlerComposer` iterates an ordered list of plugins and calls each
 * hook in sequence, so plugins compose without knowing about each other.
 */
export interface ProxyEventPlugin {
  onProxyReq?: (proxyReq: ClientRequest, req: IncomingMessage, res: ServerResponse) => void;
  onProxyRes?: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => void;
  onError?: (err: Error, req: IncomingMessage, res: ServerResponse | Socket) => void;
}
