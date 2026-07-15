#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$INVENTORY_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$INVENTORY_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/request-id/upstream-inventory.js" &
INVENTORY_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/request-id/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "  Services"
echo "  ──────────────────────────────────────────────────────────"
echo "  Gateway (public)   →  http://localhost:3000"
echo "  Health check       →  http://localhost:3000/health"
echo "  Inventory API      →  http://localhost:3000/inventory  ← request-id propagation"
echo "  ──────────────────────────────────────────────────────────"
echo ""
echo "  How it works"
echo "    • The gateway generates a UUID X-Request-ID for every inbound request"
echo "      that doesn't already carry one."
echo "    • The same ID is set on the response header so callers can correlate."
echo "    • The ID is forwarded to the upstream in the X-Request-ID header."
echo "    • The gateway's pino-http logger and every log line for that request"
echo "      share the same ID — trace a single request through the whole stack."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " W A L K T H R O U G H"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── Step 1 · Gateway generates a request ID automatically ──────"
echo ""
echo "  # The response headers include X-Request-ID."
echo "  # The upstream echoes it back in the JSON body as _requestId."
echo "  curl -si http://localhost:3000/inventory | head -20"
echo ""
echo "── Step 2 · Inspect the upstream's stdout ─────────────────────"
echo ""
echo "  # Watch the terminal where the inventory service is running."
echo "  # You will see lines like:"
echo "  #   [inventory-service] GET /  request-id=<uuid>"
echo "  # The same UUID appears in the gateway log and the upstream log."
echo "  curl -s http://localhost:3000/inventory | jq"
echo ""
echo "── Step 3 · Supply your own correlation ID ────────────────────"
echo ""
echo "  # The gateway forwards an existing X-Request-ID unchanged."
echo "  # Useful when the caller is already part of a traced system."
echo "  curl -si http://localhost:3000/inventory \\"
echo "    -H 'X-Request-ID: my-trace-abc-123'"
echo ""
echo "  # Observe:"
echo "  #   1. The response header X-Request-ID echoes your value."
echo "  #   2. The upstream log shows the same ID."
echo "  #   3. The gateway log req.id matches your ID."
echo ""
echo "── Step 4 · Trace a write operation ──────────────────────────"
echo ""
echo "  curl -si -X POST http://localhost:3000/inventory \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'X-Request-ID: create-item-op-999' \\"
echo "    -d '{\"sku\":\"WIDGET-003\",\"name\":\"Deluxe Widget\",\"stock\":10}'"
echo ""
echo "  # You will see create-item-op-999 in:"
echo "  #   • The HTTP response header"
echo "  #   • The JSON body (_requestId field)"
echo "  #   • The upstream service's log"
echo "  #   • The gateway's pino-http log"
echo ""
echo "── Step 5 · Concurrent requests get unique IDs ────────────────"
echo ""
echo "  # Run two requests in parallel — each gets its own UUID."
echo "  curl -s http://localhost:3000/inventory/1 &"
echo "  curl -s http://localhost:3000/inventory/2 &"
echo "  wait"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

wait "$GATEWAY_PID"
