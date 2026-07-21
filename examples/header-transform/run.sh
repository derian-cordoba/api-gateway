#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$ECHO_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$ECHO_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/header-transform/upstream-echo.js" &
ECHO_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/header-transform/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "  Services"
echo "  ──────────────────────────────────────────────────────────"
echo "  Gateway (public)  →  http://localhost:3000"
echo "  Health check      →  http://localhost:3000/health"
echo "  Echo API          →  http://localhost:3000/echo   ← header transforms enabled"
echo "  ──────────────────────────────────────────────────────────"
echo ""
echo "  Request header transforms (applied before forwarding to upstream)"
echo "    set:    X-Forwarded-By: api-gateway"
echo "            X-Api-Version: 2"
echo "            X-Internal-Token: secret-internal-value"
echo "    remove: user-agent"
echo ""
echo "  Response header transforms (applied before returning to client)"
echo "    set:    X-Frame-Options: DENY"
echo "            X-Custom-Upstream: overridden-by-gateway"
echo "    remove: Server"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " W A L K T H R O U G H"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── Step 1 · Inspect request header transforms ─────────────────"
echo ""
echo "  # The echo server returns all headers it received."
echo "  # Compare the 'receivedHeaders' field against what you sent."
echo "  curl -s http://localhost:3000/echo | jq '.receivedHeaders'"
echo ""
echo "  # Confirm gateway-injected headers are present:"
echo "  curl -s http://localhost:3000/echo | jq '.receivedHeaders | { \"x-forwarded-by\", \"x-api-version\", \"x-internal-token\" }'"
echo ""
echo "  # Confirm 'user-agent' was stripped (should be absent or null):"
echo "  curl -s http://localhost:3000/echo | jq '.receivedHeaders[\"user-agent\"]'"
echo ""
echo "── Step 2 · Inspect response header transforms ─────────────────"
echo ""
echo "  # 'Server' header should be absent (removed by gateway)"
echo "  curl -si http://localhost:3000/echo | grep -i '^Server:' || echo '  ✓ Server header removed'"
echo ""
echo "  # 'X-Frame-Options: DENY' should be present (added by gateway)"
echo "  curl -si http://localhost:3000/echo | grep -i 'X-Frame-Options'"
echo ""
echo "  # 'X-Custom-Upstream' should be overridden by the gateway"
echo "  curl -si http://localhost:3000/echo | grep -i 'X-Custom-Upstream'"
echo "  # Expected: X-Custom-Upstream: overridden-by-gateway"
echo "  # (upstream sends 'original-value' but gateway replaces it)"
echo ""
echo "── Step 3 · POST with a body (body is forwarded correctly) ────────"
echo ""
echo "  curl -s -X POST http://localhost:3000/echo \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"hello\":\"world\"}' | jq '{ receivedHeaders: .receivedHeaders[\"x-forwarded-by\"], body }'"
echo ""
echo "── Step 4 · Verify user-agent is stripped ──────────────────────"
echo ""
echo "  # curl normally sends 'User-Agent: curl/...' — gateway removes it"
echo "  curl -s http://localhost:3000/echo | jq '.receivedHeaders | keys | map(select(startswith(\"user\")))'"
echo "  # Expected: []"
echo ""
echo "── Tips ────────────────────────────────────────────────────────"
echo ""
echo "  Edit examples/header-transform/routes.json and save —"
echo "  the gateway reloads automatically (hot config reload)."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

wait "$GATEWAY_PID"
