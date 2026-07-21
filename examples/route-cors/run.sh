#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$API_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$API_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/route-cors/upstream-api.js" &
API_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/route-cors/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "  Services"
echo "  ──────────────────────────────────────────────────────────"
echo "  Gateway (public)   →  http://localhost:3000"
echo "  Health check       →  http://localhost:3000/health"
echo "  Public API         →  http://localhost:3000/public-api     ← global CORS (origin: *)"
echo "  Restricted API     →  http://localhost:3000/restricted-api ← route-level CORS"
echo "  ──────────────────────────────────────────────────────────"
echo ""
echo "  Global CORS (all routes):     origin: *"
echo "  Route CORS (/restricted-api): origin: http://trusted.example.com"
echo "                                         https://trusted.example.com"
echo "                                methods: GET, OPTIONS"
echo "                                maxAge:  3600 s"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " W A L K T H R O U G H"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── Step 1 · Public route — global CORS (origin: *) ────────────"
echo ""
echo "  # Regular request — ACAO header reflects global config"
echo "  curl -si http://localhost:3000/public-api | grep -i 'access-control'"
echo "  # Expected: Access-Control-Allow-Origin: *"
echo ""
echo "── Step 2 · Restricted route — route-level CORS ────────────────"
echo ""
echo "  # Request without an Origin header (no CORS headers added)"
echo "  curl -si http://localhost:3000/restricted-api | grep -i 'access-control'"
echo ""
echo "  # Allowed origin — ACAO reflects the specific domain"
echo "  curl -si http://localhost:3000/restricted-api \\"
echo "    -H 'Origin: http://trusted.example.com' | grep -i 'access-control'"
echo "  # Expected: Access-Control-Allow-Origin: http://trusted.example.com"
echo ""
echo "  # Disallowed origin — no ACAO header (request is not from a trusted origin)"
echo "  curl -si http://localhost:3000/restricted-api \\"
echo "    -H 'Origin: http://evil.example.com' | grep -i 'access-control'"
echo ""
echo "── Step 3 · Preflight (OPTIONS) on restricted route ────────────"
echo ""
echo "  # Browser preflight — gateway handles it; upstream is never hit"
echo "  curl -si -X OPTIONS http://localhost:3000/restricted-api \\"
echo "    -H 'Origin: http://trusted.example.com' \\"
echo "    -H 'Access-Control-Request-Method: GET' \\"
echo "    -H 'Access-Control-Request-Headers: Content-Type' | head -20"
echo "  # Expected: 204 No Content"
echo "  #           Access-Control-Allow-Origin: http://trusted.example.com"
echo "  #           Access-Control-Allow-Methods: GET, OPTIONS"
echo "  #           Access-Control-Max-Age: 3600"
echo ""
echo "── Step 4 · Preflight on public route — forwarded to upstream ──"
echo ""
echo "  # Without per-route cors, OPTIONS is proxied to the upstream"
echo "  curl -si -X OPTIONS http://localhost:3000/public-api \\"
echo "    -H 'Origin: http://any.example.com' \\"
echo "    -H 'Access-Control-Request-Method: GET' | head -10"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

wait "$GATEWAY_PID"
