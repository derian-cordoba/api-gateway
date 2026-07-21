import type { RequestHandler } from "express";
import type { WsUpgradeHandler } from "../ProxyManager";

/**
 * Strategy interface for the final proxy step of a route's middleware pipeline.
 *
 * Two implementations exist:
 *   - `StandardProxyBackend`  — uses http-proxy-middleware; supports WebSocket.
 *   - `RetryProxyBackend`     — uses a custom Node http/https proxy with retry
 *                               on 5xx/network errors; does not support WebSocket.
 */
export interface ProxyBackend {
  createMiddleware(): RequestHandler;
  wsUpgradeHandler(): WsUpgradeHandler | null;
}
