#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$AUTH_PID" "$ORDERS_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$AUTH_PID" "$ORDERS_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/jwt-auth/auth-service.js" &
AUTH_PID=$!

node "$ROOT/examples/jwt-auth/upstream-orders.js" &
ORDERS_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/jwt-auth/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "All services are running. Press Ctrl+C to stop."
echo ""
echo "  Gateway       →  http://localhost:3001"
echo "  Health check  →  http://localhost:3001/health"
echo "  Auth service  →  http://localhost:3001/auth"
echo "  Orders API    →  http://localhost:3001/orders  (JWT protected)"
echo ""
echo "─────────────────────────────────────────────────────"
echo " Try it out"
echo "─────────────────────────────────────────────────────"
echo ""
echo "1. Request without a token (expect 401):"
echo "   curl -s http://localhost:3001/orders | jq"
echo ""
echo "2. Login to obtain a token:"
echo "   curl -s -X POST http://localhost:3001/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"alice\",\"password\":\"password123\"}' | jq"
echo ""
echo "3. Use the token to access the orders API:"
echo "   TOKEN=\$(curl -s -X POST http://localhost:3001/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"alice\",\"password\":\"password123\"}' | jq -r '.token')"
echo "   curl -s http://localhost:3001/orders \\"
echo "     -H \"Authorization: Bearer \$TOKEN\" | jq"
echo ""
echo "4. Create a new order:"
echo "   curl -s -X POST http://localhost:3001/orders \\"
echo "     -H \"Authorization: Bearer \$TOKEN\" \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"userId\":1,\"items\":[{\"productId\":2,\"qty\":1}],\"total\":24.99}' | jq"
echo "─────────────────────────────────────────────────────"
echo ""

wait "$GATEWAY_PID"
