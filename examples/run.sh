#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$USERS_PID" "$PRODUCTS_PID" "$AUTH_PID" "$ORDERS_PID" "$REPORTS_PID" "$PAYMENTS_PID" "$INVENTORY_PID" "$ANALYTICS_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$USERS_PID" "$PRODUCTS_PID" "$AUTH_PID" "$ORDERS_PID" "$REPORTS_PID" "$PAYMENTS_PID" "$INVENTORY_PID" "$ANALYTICS_PID" "$GATEWAY_PID" 2>/dev/null || true
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

node "$ROOT/examples/circuit-breaker/upstream-payments.js" &
PAYMENTS_PID=$!

node "$ROOT/examples/request-id/upstream-inventory.js" &
INVENTORY_PID=$!

node "$ROOT/examples/ip-filter/upstream-analytics.js" &
ANALYTICS_PID=$!

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
echo "  ── Circuit breaker ─────────────────────────────────"
echo "  Payments API    →  http://localhost:3000/payments            (circuit breaker: 3 failures / 10 s)"
echo "  Payments admin  →  http://localhost:4066                     (toggle mode — not proxied)"
echo ""
echo "  ── Request ID propagation ──────────────────────────"
echo "  Inventory API   →  http://localhost:3000/inventory           (X-Request-ID auto-generated & forwarded)"
echo ""
echo "  ── IP filter ───────────────────────────────────────"
echo "  Analytics       →  http://localhost:3000/analytics/public   (no restriction)"
echo "  Analytics       →  http://localhost:3000/analytics/internal (allow: 127.0.0.1)"
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
echo ""
echo "── Circuit breaker ──"
echo "  # 1. Normal request (circuit CLOSED)"
echo "  curl -s http://localhost:3000/payments | jq"
echo ""
echo "  # 2. Degrade the upstream"
echo "  curl -s -X POST http://localhost:4066/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"failing\"}' | jq"
echo ""
echo "  # 3. Trigger threshold (3 failures open the circuit)"
echo "  curl -s http://localhost:3000/payments | jq  # failure 1"
echo "  curl -s http://localhost:3000/payments | jq  # failure 2"
echo "  curl -s http://localhost:3000/payments | jq  # failure 3 → circuit OPEN"
echo ""
echo "  # 4. Observe the open circuit (503 + Retry-After, upstream not hit)"
echo "  curl -si http://localhost:3000/payments | head -20"
echo ""
echo "  # 5. Restore the upstream"
echo "  curl -s -X POST http://localhost:4066/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"healthy\"}' | jq"
echo ""
echo "  # 6. Wait 10 s, then probe closes the circuit"
echo "  sleep 11 && curl -s http://localhost:3000/payments | jq"
echo ""
echo "── Request ID ──"
echo "  # Gateway auto-generates a UUID — visible in response headers and JSON body"
echo "  curl -si http://localhost:3000/inventory | grep -i x-request-id"
echo ""
echo "  # Supply your own correlation ID — forwarded unchanged to the upstream"
echo "  curl -si http://localhost:3000/inventory -H 'X-Request-ID: my-trace-abc'"
echo ""
echo "── IP filter ──"
echo "  # Public route — no restrictions"
echo "  curl -s http://localhost:3000/analytics/public | jq"
echo ""
echo "  # Internal route — allow: 127.0.0.1 — passes from loopback"
echo "  curl -s http://localhost:3000/analytics/internal | jq"
echo "─────────────────────────────────────────────────────"
echo ""

wait "$GATEWAY_PID"
