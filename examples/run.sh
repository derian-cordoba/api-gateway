#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$USERS_PID" "$PRODUCTS_PID" "$AUTH_PID" "$ORDERS_PID" "$REPORTS_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$USERS_PID" "$PRODUCTS_PID" "$AUTH_PID" "$ORDERS_PID" "$REPORTS_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/basic/upstream-users.js" &
USERS_PID=$!

node "$ROOT/examples/basic/upstream-products.js" &
PRODUCTS_PID=$!

node "$ROOT/examples/jwt-auth/auth-service.js" &
AUTH_PID=$!

node "$ROOT/examples/jwt-auth/upstream-orders.js" &
ORDERS_PID=$!

node "$ROOT/examples/api-key-auth/upstream-reports.js" &
REPORTS_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "All services are running. Press Ctrl+C to stop."
echo ""
echo "  Gateway         →  http://localhost:3000"
echo "  Health check    →  http://localhost:3000/health"
echo ""
echo "  ── Public routes ──────────────────────────────────"
echo "  Users API       →  http://localhost:3000/users      (rate limited)"
echo "  Products API    →  http://localhost:3000/products   (rate limited)"
echo ""
echo "  ── JWT protected ──────────────────────────────────"
echo "  Auth service    →  http://localhost:3000/auth       (open — issues tokens)"
echo "  Orders API      →  http://localhost:3000/orders     (Bearer token required)"
echo ""
echo "  ── API key protected ───────────────────────────────"
echo "  Reports API     →  http://localhost:3000/reports    (x-api-key required)"
echo "  Valid keys:         key-service-alpha-123 · key-service-beta-456"
echo ""
echo "─────────────────────────────────────────────────────"
echo " Try it out"
echo "─────────────────────────────────────────────────────"
echo ""
echo "── Public ──"
echo "  curl -s http://localhost:3000/users | jq"
echo "  curl -s http://localhost:3000/products | jq"
echo ""
echo "── JWT auth ──"
echo "  # 1. Get a token"
echo "  TOKEN=\$(curl -s -X POST http://localhost:3000/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"alice\",\"password\":\"password123\"}' | jq -r '.token')"
echo ""
echo "  # 2. Access protected route"
echo "  curl -s http://localhost:3000/orders -H \"Authorization: Bearer \$TOKEN\" | jq"
echo ""
echo "  # 3. Try without token (401)"
echo "  curl -s http://localhost:3000/orders | jq"
echo ""
echo "── API key auth ──"
echo "  # Valid key"
echo "  curl -s http://localhost:3000/reports -H 'x-api-key: key-service-alpha-123' | jq"
echo ""
echo "  # Wrong key (401)"
echo "  curl -s http://localhost:3000/reports -H 'x-api-key: wrong' | jq"
echo "─────────────────────────────────────────────────────"
echo ""

wait "$GATEWAY_PID"
