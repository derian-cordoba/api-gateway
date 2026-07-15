/**
 * Example upstream: Chat Service
 *
 * A minimal WebSocket server built with Node.js built-ins only (no `ws` package).
 * It implements just enough of RFC 6455 to demonstrate gateway WS proxying:
 *   - Handles the HTTP → WebSocket upgrade handshake
 *   - Decodes and re-encodes masked text frames
 *   - Echoes every message back with a server prefix
 *   - Handles ping/pong frames
 *   - Sends a connection-count update to all clients on connect/disconnect
 *
 * The gateway proxies WebSocket connections to this service at /chat.
 *
 * Runs on http://localhost:4020  (proxied by the gateway at /chat with ws: true)
 *
 * Test with wscat (npm i -g wscat):
 *   wscat -c ws://localhost:3000/chat
 *
 * Or with websocat (https://github.com/vi/websocat):
 *   websocat ws://localhost:3000/chat
 *
 * Or with a raw HTTP upgrade:
 *   curl -si --no-buffer http://localhost:3000/chat \
 *     -H "Upgrade: websocket" \
 *     -H "Connection: Upgrade" \
 *     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
 *     -H "Sec-WebSocket-Version: 13"
 */

const http   = require("http");
const crypto = require("crypto");

const PORT = Number(process.env.CHAT_PORT || 4020);
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// ── Active connections ─────────────────────────────────────────────────────

/** @type {Set<import("net").Socket>} */
const clients = new Set();

// ── WebSocket frame helpers ────────────────────────────────────────────────

/**
 * Build an unmasked server→client text frame.
 * @param {string} text
 * @returns {Buffer}
 */
function buildTextFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const len     = payload.length;

  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + opcode=1 (text)
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

/**
 * Build an unmasked pong frame.
 * @param {Buffer} payload
 * @returns {Buffer}
 */
function buildPongFrame(payload) {
  const header = Buffer.alloc(2);
  header[0] = 0x8a; // FIN + opcode=10 (pong)
  header[1] = payload.length;
  return Buffer.concat([header, payload]);
}

/**
 * Parse the first complete WebSocket frame from a buffer.
 * Returns { opcode, payload, consumed } or null if the buffer is incomplete.
 *
 * @param {Buffer} buf
 * @returns {{ opcode: number, payload: Buffer, consumed: number } | null}
 */
function parseFrame(buf) {
  if (buf.length < 2) return null;

  const isMasked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  const maskLen = isMasked ? 4 : 0;
  const frameEnd = offset + maskLen + payloadLen;
  if (buf.length < frameEnd) return null;

  let payload = buf.slice(offset + maskLen, frameEnd);
  if (isMasked) {
    const mask = buf.slice(offset, offset + 4);
    payload = Buffer.from(payload); // copy before mutating
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  return { opcode: buf[0] & 0x0f, payload, consumed: frameEnd };
}

// ── Broadcast ──────────────────────────────────────────────────────────────

function broadcast(text) {
  const frame = buildTextFrame(text);
  for (const socket of clients) {
    try { socket.write(frame); } catch { /* ignore closed socket */ }
  }
}

// ── HTTP server (handles both plain HTTP and WebSocket upgrades) ───────────

const server = http.createServer((_req, res) => {
  // Plain HTTP requests return a simple status page
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "chat", clients: clients.size, port: PORT }));
});

server.on("upgrade", (req, socket) => {
  // Only accept WebSocket upgrades
  if (req.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  const key    = req.headers["sec-websocket-key"] ?? "";
  const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  clients.add(socket);
  console.log(`[chat-service] client connected  (total: ${clients.size})`);
  broadcast(`[server] clients online: ${clients.size}`);

  // Welcome message
  socket.write(buildTextFrame(`[server] Welcome! You are client #${clients.size}. Type a message and press Enter.`));

  // Handle incoming frames
  let buf = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);

    while (buf.length > 0) {
      const frame = parseFrame(buf);
      if (!frame) break;

      buf = buf.slice(frame.consumed);

      switch (frame.opcode) {
        case 0x1: { // text
          const text = frame.payload.toString("utf8");
          console.log(`[chat-service] message received: ${text}`);
          // Echo back with a server prefix
          socket.write(buildTextFrame(`[echo] ${text}`));
          break;
        }
        case 0x8: // close
          console.log(`[chat-service] client requested close`);
          socket.destroy();
          break;
        case 0x9: // ping
          socket.write(buildPongFrame(frame.payload));
          break;
        default:
          break;
      }
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
    console.log(`[chat-service] client disconnected (total: ${clients.size})`);
    if (clients.size > 0) broadcast(`[server] clients online: ${clients.size}`);
  });

  socket.on("error", (err) => {
    console.error(`[chat-service] socket error: ${err.message}`);
    clients.delete(socket);
  });
});

server.listen(PORT, () => {
  console.log(`[chat-service]  listening on http://localhost:${PORT}`);
  console.log(`[chat-service]  WebSocket URL: ws://localhost:${PORT}`);
});
