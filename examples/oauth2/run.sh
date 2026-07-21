#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$AUTH_PID" "$API_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$AUTH_PID" "$API_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."

node "$ROOT/examples/oauth2/auth-server.js" &
AUTH_PID=$!

node "$ROOT/examples/oauth2/upstream-protected.js" &
API_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/oauth2/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "  Services"
echo "  ──────────────────────────────────────────────────────────"
echo "  Gateway (public)  →  http://localhost:3000"
echo "  Health check      →  http://localhost:3000/health"
echo "  Auth (login)      →  http://localhost:3000/auth/login   ← issues opaque tokens"
echo "  Protected API     →  http://localhost:3000/protected    ← OAuth 2.0 introspection"
echo ""
echo "  Auth server       →  http://localhost:4062              ← not exposed directly"
echo "  Protected API     →  http://localhost:4063              ← not exposed directly"
echo "  ──────────────────────────────────────────────────────────"
echo ""
echo "  OAuth 2.0 config (routes.json)"
echo "    strategy:         oauth2"
echo "    introspectionUrl: http://localhost:4062/introspect"
echo "    clientId:         gateway-client"
echo "    clientSecret:     gw-s3cr3t"
echo ""
echo "  Test users:  alice / password123   ·   bob / password456"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " W A L K T H R O U G H"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── Step 1 · Try without a token (401) ─────────────────────────"
echo ""
echo "  curl -s http://localhost:3000/protected | jq"
echo "  # Expected: 401 Unauthorized"
echo "  #           { \"error\": \"Missing or malformed Authorization header\" }"
echo ""
echo "── Step 2 · Obtain an opaque Bearer token ──────────────────────"
echo ""
echo "  TOKEN=\$(curl -s -X POST http://localhost:3000/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"alice\",\"password\":\"password123\"}' | jq -r '.access_token')"
echo "  echo \"\$TOKEN\""
echo ""
echo "── Step 3 · Access the protected route ─────────────────────────"
echo ""
echo "  curl -s http://localhost:3000/protected \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" | jq"
echo "  # The gateway introspects the token, confirms active: true,"
echo "  # then forwards the request to the upstream."
echo ""
echo "── Step 4 · Use a forged / expired token (401) ─────────────────"
echo ""
echo "  curl -s http://localhost:3000/protected \\"
echo "    -H 'Authorization: Bearer tok_this_is_fake' | jq"
echo "  # Expected: 401 Unauthorized"
echo "  #           { \"error\": \"Token is inactive or invalid\" }"
echo ""
echo "── Step 5 · Introspect a token directly (not via gateway) ───────"
echo ""
echo "  # The auth server's /introspect endpoint requires Basic auth"
echo "  # using the gateway's clientId and clientSecret."
echo "  TOKEN=\$(curl -s -X POST http://localhost:3000/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"bob\",\"password\":\"password456\"}' | jq -r '.access_token')"
echo ""
echo "  curl -s -X POST http://localhost:4062/introspect \\"
echo "    -u gateway-client:gw-s3cr3t \\"
echo "    -d \"token=\$TOKEN\" | jq"
echo "  # Expected: { \"active\": true, \"sub\": \"bob\", ... }"
echo ""
echo "── Step 6 · Tokens expire after 5 minutes ──────────────────────"
echo ""
echo "  # The token TTL is 5 minutes. After expiry:"
echo "  # curl -s http://localhost:3000/protected -H \"Authorization: Bearer \$TOKEN\" | jq"
echo "  # Expected: 401 — { \"error\": \"Token is inactive or invalid\" }"
echo ""
echo "── Tips ────────────────────────────────────────────────────────"
echo ""
echo "  Swap to Bob's credentials:  username=bob / password=password456"
echo "  The gateway is stateless — it calls /introspect on every request."
echo "  In production you would add a short cache to avoid hammering the"
echo "  introspection endpoint on every request."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

wait "$GATEWAY_PID"
