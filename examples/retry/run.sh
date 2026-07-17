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
node "$ROOT/examples/retry/upstream-inventory.js" &
INVENTORY_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/retry/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "  Services"
echo "  ──────────────────────────────────────────────────────────"
echo "  Gateway (public)   →  http://localhost:3000"
echo "  Health check       →  http://localhost:3000/health"
echo "  Inventory API      →  http://localhost:3000/inventory  ← retry enabled"
echo ""
echo "  Inventory admin    →  http://localhost:4011            ← not exposed through gateway"
echo "  ──────────────────────────────────────────────────────────"
echo ""
echo "  Retry config (routes.json)"
echo "    attempts   3 retries after first failure"
echo "    delay      200 ms base delay"
echo "    backoff    exponential  (200 ms → 400 ms → 800 ms)"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " W A L K T H R O U G H"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── Step 1 · Normal operation ──────────────────────────────────"
echo ""
echo "  # List inventory — upstream is healthy, no retries needed"
echo "  curl -s http://localhost:3000/inventory | jq"
echo ""
echo "── Step 2 · Simulate a transient fault (fails 2 times, then recovers) ─"
echo ""
echo "  curl -s -X POST http://localhost:4011/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"flaky\",\"failCount\":2}' | jq"
echo ""
echo "  # The gateway retries transparently — the client still gets 200"
echo "  # Watch the upstream log to see calls #1 and #2 returning 500,"
echo "  # then call #3 succeeding."
echo "  curl -s http://localhost:3000/inventory | jq"
echo ""
echo "── Step 3 · Exhaust all retries ───────────────────────────────"
echo ""
echo "  # Reset the upstream to always-failing mode"
echo "  curl -s -X POST http://localhost:4011/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"failing\"}' | jq"
echo ""
echo "  # After 3 retries (4 total upstream calls), the gateway gives up"
echo "  # and returns 500 to the client."
echo "  curl -s http://localhost:3000/inventory | jq"
echo ""
echo "── Step 4 · Restore the upstream ─────────────────────────────"
echo ""
echo "  curl -s -X POST http://localhost:4011/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"healthy\"}' | jq"
echo ""
echo "  curl -s http://localhost:3000/inventory | jq"
echo ""
echo "── Tips ────────────────────────────────────────────────────────"
echo ""
echo "  Check current upstream mode and call counter:"
echo "    curl -s http://localhost:4011/status | jq"
echo ""
echo "  Watch the gateway log for retry messages:"
echo "    Upstream returned 5xx — retrying  (attempt N)"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

wait "$GATEWAY_PID"
