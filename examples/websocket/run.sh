#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$CHAT_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$CHAT_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/websocket/upstream-chat.js" &
CHAT_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/websocket/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "  Services"
echo "  ──────────────────────────────────────────────────────────"
echo "  Gateway (public)   →  http://localhost:3000"
echo "  Chat WebSocket     →  ws://localhost:3000/chat    ← ws: true"
echo "  Chat status (HTTP) →  http://localhost:3000/chat-status"
echo "  ──────────────────────────────────────────────────────────"
echo ""
echo "  How it works"
echo "    When a client sends an HTTP Upgrade request to /chat, the gateway"
echo "    intercepts the upgrade event on the raw HTTP server and forwards"
echo "    the WebSocket handshake to the upstream chat service."
echo "    All subsequent WebSocket frames are tunnelled transparently."
echo ""
echo "    The /chat-status route is a plain HTTP endpoint on the same upstream"
echo "    that reports how many WebSocket clients are currently connected."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " W A L K T H R O U G H"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── Prerequisite: a WebSocket client ───────────────────────"
echo ""
echo "  Install one of (choose any):"
echo "    npm install -g wscat        # then: wscat -c ws://localhost:3000/chat"
echo "    brew install websocat       # then: websocat ws://localhost:3000/chat"
echo ""
echo "── Step 1 · Confirm the HTTP status endpoint works ─────────"
echo ""
echo "  curl -s http://localhost:3000/chat-status | jq"
echo "  # { service: 'chat', clients: 0, port: 4020 }"
echo ""
echo "── Step 2 · Open a WebSocket connection through the gateway ─"
echo ""
echo "  wscat -c ws://localhost:3000/chat"
echo "  # Connected (press CTRL+C to quit)"
echo "  # < [server] Welcome! You are client #1. Type a message and press Enter."
echo ""
echo "── Step 3 · Send messages ──────────────────────────────────"
echo ""
echo "  # Type any text and press Enter."
echo "  hello gateway"
echo "  # < [echo] hello gateway"
echo ""
echo "── Step 4 · Open a second connection in another terminal ────"
echo ""
echo "  wscat -c ws://localhost:3000/chat"
echo "  # Both clients receive: [server] clients online: 2"
echo ""
echo "── Step 5 · Inspect the raw upgrade handshake ─────────────"
echo ""
echo "  # curl shows the 101 Switching Protocols response the gateway"
echo "  # forwards from the upstream (connection then hangs open)."
echo "  curl -si http://localhost:3000/chat \\"
echo "    -H 'Upgrade: websocket' \\"
echo "    -H 'Connection: Upgrade' \\"
echo "    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \\"
echo "    -H 'Sec-WebSocket-Version: 13' \\"
echo "    | head -10"
echo ""
echo "  # Expected:"
echo "  # HTTP/1.1 101 Switching Protocols"
echo "  # Upgrade: websocket"
echo "  # Connection: Upgrade"
echo "  # Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

wait "$GATEWAY_PID"
