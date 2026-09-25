import type { Request, Response } from "express";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { getReasonPhrase, StatusCodes as HttpStatus } from "http-status-codes";
import { createAuthMiddleware } from "../middleware/authMiddleware";
import type { Auth } from "../types/auth";

export type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

/**
 * Adds route matching and authentication to an http-proxy-middleware upgrade
 * handler. Express middleware does not run for HTTP upgrade events, so the
 * same auth strategy is invoked against a lightweight request/response
 * adapter and rejected upgrades receive an HTTP 401 before the socket closes.
 */
export function createProtectedUpgradeHandler(
  baseURL: string,
  prefix: string,
  auth: Auth | undefined,
  handler: UpgradeHandler,
  limits: { maxConnections?: number; idleTimeoutMs?: number } = {},
): UpgradeHandler {
  const authenticate = auth?.enabled ? createAuthMiddleware(auth) : null;
  const routePath = joinPath(prefix, baseURL);
  let activeConnections = 0;

  return (req, socket, head) => {
    if (!matchesPath(req.url ?? "/", routePath)) {
      return;
    }

    if (!authenticate) {
      if (!reserveConnection(socket, limits.maxConnections, () => { activeConnections--; })) return;
      activeConnections++;
      applyIdleTimeout(socket, limits.idleTimeoutMs);
      handler(req, socket, head);
      return;
    }

    const response = createUpgradeResponse(socket);

    authenticate(req as Request, response, () => {
      if (!reserveConnection(socket, limits.maxConnections, () => { activeConnections--; })) return;
      activeConnections++;
      applyIdleTimeout(socket, limits.idleTimeoutMs);
      handler(req, socket, head);
    });
  };

  function reserveConnection(socket: Duplex, maximum: number | undefined, onClose: () => void): boolean {
    if (maximum !== undefined && activeConnections >= maximum) {
      rejectUpgrade(socket, HttpStatus.SERVICE_UNAVAILABLE, "WebSocket connection limit reached");
      return false;
    }

    socket.once("close", onClose);
    return true;
  }

  function applyIdleTimeout(socket: Duplex, timeoutMs: number | undefined): void {
    const socketWithTimeout = socket as Duplex & {
      setTimeout?: (milliseconds: number, callback: () => void) => void;
    };

    if (timeoutMs !== undefined && socketWithTimeout.setTimeout) {
      socketWithTimeout.setTimeout(timeoutMs, () => socket.destroy());
    }
  }
}

function joinPath(prefix: string, baseURL: string): string {
  const normalizedPrefix = prefix === "/" ? "" : prefix.replace(/\/$/, "");
  return `${normalizedPrefix}/${baseURL.replace(/^\//, "")}` || "/";
}

function matchesPath(requestUrl: string, routePath: string): boolean {
  const pathname = requestUrl.split("?", 1)[0];
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

function createUpgradeResponse(socket: Duplex): Response {
  let statusCode = HttpStatus.UNAUTHORIZED;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    set() {
      return response;
    },
    setHeader() {
      return response;
    },
    json(body: unknown) {
      if (!socket.destroyed) {
        rejectUpgrade(socket, statusCode, JSON.stringify(body));
      }

      return response;
    },
  } as unknown as Response;

  return response;
}

function rejectUpgrade(socket: Duplex, statusCode: number, message: string): void {
  if (socket.destroyed) return;
  const payload = message.startsWith("{") ? message : JSON.stringify({ error: message });
  socket.write(
    `HTTP/1.1 ${statusCode} ${getReasonPhrase(statusCode)}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n${payload}`,
  );
  socket.destroy();
}
