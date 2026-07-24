/**
 * Integration tests for WebSocket proxying.
 *
 * Uses only Node.js built-in modules — no ws package required.
 * A minimal echo WebSocket server handles the RFC 6455 handshake and
 * frames; the test client drives a raw HTTP upgrade through the gateway.
 *
 * Port: 19_120 (upstream WS echo server)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer, request as httpRequest } from "http";
import { createHash } from "node:crypto";
import { createServer as createNetServer } from "net";
import supertest from "supertest";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_120;
const GATEWAY_PORT = 19_121;

// ── Minimal WebSocket frame helpers ──────────────────────────────────────────

function buildAcceptKey(clientKey: string): string {
  return createHash("sha1")
    .update(`${clientKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

/** Build a minimal unmasked WebSocket text frame. */
function encodeFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf-8");
  const frame = Buffer.allocUnsafe(2 + payload.length);
  frame[0] = 0x81; // FIN + text opcode
  frame[1] = payload.length & 0x7f;
  payload.copy(frame, 2);
  return frame;
}

/** Parse the first WebSocket frame from a buffer (unmasked text). */
function decodeFirstFrame(buf: Buffer): string | null {
  if (buf.length < 2) return null;
  const payloadLen = buf[1] & 0x7f;
  if (buf.length < 2 + payloadLen) return null;
  return buf.subarray(2, 2 + payloadLen).toString("utf-8");
}

// ── Minimal echo WebSocket upstream ──────────────────────────────────────────

/** Tracks all open WebSocket sockets so they can be forcibly destroyed on teardown. */
const upstreamWsSockets = new Set<import("net").Socket>();

function startWsEchoUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = createServer();

    server.on("upgrade", (req, socket) => {
      const key = req.headers["sec-websocket-key"] as string;
      const accept = buildAcceptKey(key);

      upstreamWsSockets.add(socket);
      socket.on("close", () => upstreamWsSockets.delete(socket));

      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );

      socket.on("data", (buf: Buffer) => {
        // Decode masked frame from client (RFC 6455 §5.3)
        const masked = (buf[1] & 0x80) !== 0;
        const payloadLen = buf[1] & 0x7f;
        const maskStart = masked ? 2 : 2;
        const dataStart = masked ? maskStart + 4 : maskStart;
        const mask = masked ? buf.subarray(maskStart, maskStart + 4) : null;
        const payload = buf.subarray(dataStart, dataStart + payloadLen);

        if (mask) {
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
          }
        }

        const text = payload.toString("utf-8");
        socket.write(encodeFrame(`echo:${text}`));
      });
    });

    server.listen(UPSTREAM_PORT, () => resolve(server));
  });
}

/** Make a WebSocket upgrade request to the gateway and return the upgraded socket. */
function wsConnect(
  gatewayPort: number,
  path: string,
): Promise<{ socket: import("net").Socket; serverKey: string }> {
  return new Promise((resolve, reject) => {
    const clientKey = Buffer.from("test-client-key").toString("base64");

    const req = httpRequest({
      hostname: "127.0.0.1",
      port: gatewayPort,
      path,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": clientKey,
      },
    });

    req.on("upgrade", (_res, socket) => {
      resolve({ socket, serverKey: clientKey });
    });

    req.on("error", reject);
    req.end();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WebSocket proxying — integration", () => {
  let upstream: HttpServer;
  let gateway: Server;
  let gatewayPort: number;

  beforeAll(async () => {
    upstream = await startWsEchoUpstream();

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/ws",
        proxy: {
          target: `http://localhost:${UPSTREAM_PORT}`,
          changeOrigin: true,
          ws: true,
        },
      },
    ]);

    gateway = new Server();
    await gateway.init();

    // Bind the underlying HTTP server (not a new Express-created server) so
    // that WebSocket upgrade events are delivered to the registered handlers.
    await new Promise<void>((resolve) => {
      gateway.getHttpServer().listen(GATEWAY_PORT, () => resolve());
    });
    gatewayPort = GATEWAY_PORT;
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    // Destroy any WebSocket sockets that the upstream echo server still holds.
    // Node's HTTP server does NOT close upgrade sockets automatically when the
    // remote end disconnects, so we must force-destroy them before calling
    // server.close() — otherwise it blocks indefinitely.
    for (const sock of upstreamWsSockets) sock.destroy();
    upstreamWsSockets.clear();

    await gateway.stop();
    await new Promise<void>((r) => upstream.close(() => r()));
  });

  it("completes the WebSocket upgrade handshake through the gateway", async () => {
    const { socket } = await wsConnect(gatewayPort, "/ws");
    expect(socket).toBeDefined();
    socket.destroy();
  });

  it("proxies WebSocket frames to the echo upstream and back", async () => {
    const { socket } = await wsConnect(gatewayPort, "/ws");

    const reply = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket reply timed out")), 3000);

      socket.once("data", (buf: Buffer) => {
        clearTimeout(timer);
        const text = decodeFirstFrame(buf);
        resolve(text ?? "");
      });

      // Send a masked text frame (RFC 6455 §5.3 — clients MUST mask frames)
      const payload = Buffer.from("hello", "utf-8");
      const mask = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const frame = Buffer.allocUnsafe(6 + payload.length);
      frame[0] = 0x81; // FIN + text opcode
      frame[1] = 0x80 | payload.length; // MASK bit + payload length
      mask.copy(frame, 2);
      for (let i = 0; i < payload.length; i++) {
        frame[6 + i] = payload[i] ^ mask[i % 4];
      }
      socket.write(frame);
    });

    expect(reply).toBe("echo:hello");
    socket.destroy();
  });
});
