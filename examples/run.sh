#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Port list ────────────────────────────────────────────────────────────────
# All ports used by this combined example. Kept in one place so freeing and
# the service table below stay in sync.
GATEWAY_PORT=3000
USERS_PORT=4001
PRODUCTS_PORT=4002
AUTH_PORT=4003
ORDERS_PORT=4004
REPORTS_PORT=4005
PAYMENTS_PORT=4006
PAYMENTS_ADMIN_PORT=4066
INVENTORY_PORT=4007
ANALYTICS_PORT=4008
CATALOG_A_PORT=4010
CATALOG_B_PORT=4011
CATALOG_C_PORT=4012
CHAT_PORT=4020
RETRY_INVENTORY_PORT=4040
RETRY_INVENTORY_ADMIN_PORT=4041
CACHED_CATALOG_PORT=4050
METRICS_ORDERS_PORT=4030
METRICS_ORDERS_ADMIN_PORT=4031

ALL_PORTS=(
  $GATEWAY_PORT
  $USERS_PORT $PRODUCTS_PORT $AUTH_PORT $ORDERS_PORT $REPORTS_PORT
  $PAYMENTS_PORT $PAYMENTS_ADMIN_PORT $INVENTORY_PORT $ANALYTICS_PORT
  $CATALOG_A_PORT $CATALOG_B_PORT $CATALOG_C_PORT $CHAT_PORT
  $RETRY_INVENTORY_PORT $RETRY_INVENTORY_ADMIN_PORT
  $CACHED_CATALOG_PORT
  $METRICS_ORDERS_PORT $METRICS_ORDERS_ADMIN_PORT
)

# ── Free ports ───────────────────────────────────────────────────────────────
echo "Freeing ports..."
for port in "${ALL_PORTS[@]}"; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  killing process(es) on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
echo "Done."
echo ""

# ── Cleanup on exit ──────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill \
    "$USERS_PID" "$PRODUCTS_PID" "$AUTH_PID" "$ORDERS_PID" "$REPORTS_PID" \
    "$PAYMENTS_PID" "$INVENTORY_PID" "$ANALYTICS_PID" \
    "$CATALOG_A_PID" "$CATALOG_B_PID" "$CATALOG_C_PID" "$CHAT_PID" \
    "$RETRY_INVENTORY_PID" "$CACHED_CATALOG_PID" "$METRICS_ORDERS_PID" \
    "$GATEWAY_PID" \
    2>/dev/null || true
  wait \
    "$USERS_PID" "$PRODUCTS_PID" "$AUTH_PID" "$ORDERS_PID" "$REPORTS_PID" \
    "$PAYMENTS_PID" "$INVENTORY_PID" "$ANALYTICS_PID" \
    "$CATALOG_A_PID" "$CATALOG_B_PID" "$CATALOG_C_PID" "$CHAT_PID" \
    "$RETRY_INVENTORY_PID" "$CACHED_CATALOG_PID" "$METRICS_ORDERS_PID" \
    "$GATEWAY_PID" \
    2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

# ── Start upstreams ──────────────────────────────────────────────────────────
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

CATALOG_PORT=$CATALOG_A_PORT CATALOG_INSTANCE=A node "$ROOT/examples/load-balancer/upstream-catalog.js" &
CATALOG_A_PID=$!

CATALOG_PORT=$CATALOG_B_PORT CATALOG_INSTANCE=B node "$ROOT/examples/load-balancer/upstream-catalog.js" &
CATALOG_B_PID=$!

CATALOG_PORT=$CATALOG_C_PORT CATALOG_INSTANCE=C node "$ROOT/examples/load-balancer/upstream-catalog.js" &
CATALOG_C_PID=$!

node "$ROOT/examples/websocket/upstream-chat.js" &
CHAT_PID=$!

INVENTORY_PORT=$RETRY_INVENTORY_PORT INVENTORY_ADMIN_PORT=$RETRY_INVENTORY_ADMIN_PORT \
  node "$ROOT/examples/retry/upstream-inventory.js" &
RETRY_INVENTORY_PID=$!

CATALOG_PORT=$CACHED_CATALOG_PORT \
  node "$ROOT/examples/cache/upstream-catalog.js" &
CACHED_CATALOG_PID=$!

ORDERS_PORT=$METRICS_ORDERS_PORT ORDERS_ADMIN_PORT=$METRICS_ORDERS_ADMIN_PORT \
  node "$ROOT/examples/metrics/upstream-orders.js" &
METRICS_ORDERS_PID=$!

# ── Start gateway ────────────────────────────────────────────────────────────
echo "Starting gateway..."
cp "$ROOT/examples/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

# ── Service table ────────────────────────────────────────────────────────────
echo ""
echo "All services are running. Press Ctrl+C to stop."
echo ""
echo "  Gateway         →  http://localhost:$GATEWAY_PORT"
echo "  Health check    →  http://localhost:$GATEWAY_PORT/health"
echo "  Metrics         →  http://localhost:$GATEWAY_PORT/metrics"
echo ""
echo "  ── Public routes ──────────────────────────────────────────────────"
echo "  Users API       →  http://localhost:$GATEWAY_PORT/users         (rate limited)"
echo "  Products API    →  http://localhost:$GATEWAY_PORT/products      (rate limited)"
echo ""
echo "  ── JWT protected ──────────────────────────────────────────────────"
echo "  Auth service    →  http://localhost:$GATEWAY_PORT/auth          (open — issues tokens)"
echo "  Orders API      →  http://localhost:$GATEWAY_PORT/orders        (Bearer token required)"
echo ""
echo "  ── API key protected ──────────────────────────────────────────────"
echo "  Reports API     →  http://localhost:$GATEWAY_PORT/reports       (x-api-key required)"
echo "  Valid keys:         key-service-alpha-123 · key-service-beta-456"
echo ""
echo "  ── Circuit breaker ────────────────────────────────────────────────"
echo "  Payments API    →  http://localhost:$GATEWAY_PORT/payments      (3 failures / 10 s)"
echo "  Payments admin  →  http://localhost:$PAYMENTS_ADMIN_PORT        (toggle mode — not proxied)"
echo ""
echo "  ── Request ID propagation ─────────────────────────────────────────"
echo "  Inventory API   →  http://localhost:$GATEWAY_PORT/inventory     (X-Request-ID forwarded)"
echo ""
echo "  ── IP filter ──────────────────────────────────────────────────────"
echo "  Analytics       →  http://localhost:$GATEWAY_PORT/analytics/public   (no restriction)"
echo "  Analytics       →  http://localhost:$GATEWAY_PORT/analytics/internal (allow: 127.0.0.1)"
echo ""
echo "  ── Load balancing ─────────────────────────────────────────────────"
echo "  Catalog API     →  http://localhost:$GATEWAY_PORT/catalog       (round-robin: A · B · C)"
echo "  Catalog A       →  http://localhost:$CATALOG_A_PORT"
echo "  Catalog B       →  http://localhost:$CATALOG_B_PORT"
echo "  Catalog C       →  http://localhost:$CATALOG_C_PORT"
echo ""
echo "  ── WebSocket ──────────────────────────────────────────────────────"
echo "  Chat WebSocket  →  ws://localhost:$GATEWAY_PORT/chat            (ws: true)"
echo ""
echo "  ── Retry with backoff ─────────────────────────────────────────────"
echo "  Retry inventory →  http://localhost:$GATEWAY_PORT/retry-inventory  (3 attempts, exponential)"
echo "  Inventory admin →  http://localhost:$RETRY_INVENTORY_ADMIN_PORT    (toggle mode — not proxied)"
echo ""
echo "  ── Response caching ───────────────────────────────────────────────"
echo "  Cached catalog  →  http://localhost:$GATEWAY_PORT/cached-catalog   (TTL 30 s, GET/HEAD)"
echo ""
echo "  ── Prometheus metrics ─────────────────────────────────────────────"
echo "  Metrics orders  →  http://localhost:$GATEWAY_PORT/metrics-orders   (cached, drives counters)"
echo "  Orders admin    →  http://localhost:$METRICS_ORDERS_ADMIN_PORT      (toggle mode — not proxied)"
echo ""
echo "─────────────────────────────────────────────────────────────────────"
echo " Try it out"
echo "─────────────────────────────────────────────────────────────────────"
echo ""
echo "── Public ──"
echo "  curl -s http://localhost:$GATEWAY_PORT/users | jq"
echo "  curl -s http://localhost:$GATEWAY_PORT/products | jq"
echo ""
echo "── JWT auth ──"
echo "  # 1. Get a token"
echo "  TOKEN=\$(curl -s -X POST http://localhost:$GATEWAY_PORT/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"alice\",\"password\":\"password123\"}' | jq -r '.token')"
echo ""
echo "  # 2. Access protected route"
echo "  curl -s http://localhost:$GATEWAY_PORT/orders -H \"Authorization: Bearer \$TOKEN\" | jq"
echo ""
echo "  # 3. Try without token (401)"
echo "  curl -s http://localhost:$GATEWAY_PORT/orders | jq"
echo ""
echo "── API key auth ──"
echo "  # Valid key"
echo "  curl -s http://localhost:$GATEWAY_PORT/reports -H 'x-api-key: key-service-alpha-123' | jq"
echo ""
echo "  # Wrong key (401)"
echo "  curl -s http://localhost:$GATEWAY_PORT/reports -H 'x-api-key: wrong' | jq"
echo ""
echo "── Circuit breaker ──"
echo "  # 1. Normal request (circuit CLOSED)"
echo "  curl -s http://localhost:$GATEWAY_PORT/payments | jq"
echo ""
echo "  # 2. Degrade the upstream"
echo "  curl -s -X POST http://localhost:$PAYMENTS_ADMIN_PORT/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"failing\"}' | jq"
echo ""
echo "  # 3. Trigger threshold (3 failures open the circuit)"
echo "  curl -s http://localhost:$GATEWAY_PORT/payments | jq  # failure 1"
echo "  curl -s http://localhost:$GATEWAY_PORT/payments | jq  # failure 2"
echo "  curl -s http://localhost:$GATEWAY_PORT/payments | jq  # failure 3 → circuit OPEN"
echo ""
echo "  # 4. Observe the open circuit (503 + Retry-After, upstream not hit)"
echo "  curl -si http://localhost:$GATEWAY_PORT/payments | head -20"
echo ""
echo "  # 5. Restore the upstream"
echo "  curl -s -X POST http://localhost:$PAYMENTS_ADMIN_PORT/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"healthy\"}' | jq"
echo ""
echo "  # 6. Wait 10 s, then probe closes the circuit"
echo "  sleep 11 && curl -s http://localhost:$GATEWAY_PORT/payments | jq"
echo ""
echo "── Request ID ──"
echo "  # Auto-generated UUID visible in response headers and forwarded upstream"
echo "  curl -si http://localhost:$GATEWAY_PORT/inventory | grep -i x-request-id"
echo ""
echo "  # Supply your own correlation ID — forwarded unchanged"
echo "  curl -si http://localhost:$GATEWAY_PORT/inventory -H 'X-Request-ID: my-trace-abc'"
echo ""
echo "── IP filter ──"
echo "  # Public route — no restrictions"
echo "  curl -s http://localhost:$GATEWAY_PORT/analytics/public | jq"
echo ""
echo "  # Internal route — allow: 127.0.0.1 — passes from loopback"
echo "  curl -s http://localhost:$GATEWAY_PORT/analytics/internal | jq"
echo ""
echo "── Load balancing (round-robin across A · B · C) ──"
echo "  for i in 1 2 3 4; do"
echo "    curl -s http://localhost:$GATEWAY_PORT/catalog | jq '{ instance, port }'"
echo "  done"
echo ""
echo "── WebSocket ──"
echo "  # Install a WS client first: npm i -g wscat"
echo "  wscat -c ws://localhost:$GATEWAY_PORT/chat"
echo ""
echo "── Retry with backoff ──"
echo "  # Healthy upstream — no retries needed"
echo "  curl -s http://localhost:$GATEWAY_PORT/retry-inventory | jq"
echo ""
echo "  # Switch to flaky mode (fails 2 times, then recovers on 3rd call)"
echo "  curl -s -X POST http://localhost:$RETRY_INVENTORY_ADMIN_PORT/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"flaky\",\"failCount\":2}' | jq"
echo ""
echo "  # Gateway retries transparently — client still gets 200"
echo "  curl -s http://localhost:$GATEWAY_PORT/retry-inventory | jq"
echo ""
echo "  # Check upstream call counter to confirm 3 total calls were made"
echo "  curl -s http://localhost:$RETRY_INVENTORY_ADMIN_PORT/status | jq"
echo ""
echo "  # Switch to always-failing (retry exhaustion → 500 to client)"
echo "  curl -s -X POST http://localhost:$RETRY_INVENTORY_ADMIN_PORT/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"failing\"}' | jq"
echo "  curl -s http://localhost:$GATEWAY_PORT/retry-inventory | jq"
echo ""
echo "  # Restore"
echo "  curl -s -X POST http://localhost:$RETRY_INVENTORY_ADMIN_PORT/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"healthy\"}' | jq"
echo ""
echo "── Response caching ──"
echo "  # First request is a MISS (200 ms upstream latency)"
echo "  curl -si http://localhost:$GATEWAY_PORT/cached-catalog | grep -E 'X-Cache|X-Request-Count'"
echo ""
echo "  # Subsequent requests are HITs (instant, upstream not called)"
echo "  curl -si http://localhost:$GATEWAY_PORT/cached-catalog | grep -E 'X-Cache|X-Request-Count'"
echo "  curl -si http://localhost:$GATEWAY_PORT/cached-catalog | grep -E 'X-Cache|X-Request-Count'"
echo ""
echo "  # Different URLs have independent cache entries"
echo "  curl -si http://localhost:$GATEWAY_PORT/cached-catalog/1 | grep -E 'X-Cache|X-Request-Count'"
echo ""
echo "  # Compare latency"
echo "  time curl -s http://localhost:$GATEWAY_PORT/cached-catalog > /dev/null  # first:  ~200 ms"
echo "  time curl -s http://localhost:$GATEWAY_PORT/cached-catalog > /dev/null  # second: <5 ms"
echo ""
echo "── Prometheus metrics ──"
echo "  # Generate traffic so counters are non-zero"
echo "  curl -s http://localhost:$GATEWAY_PORT/metrics-orders | jq"
echo "  curl -s http://localhost:$GATEWAY_PORT/metrics-orders | jq  # cache HIT"
echo ""
echo "  # View all gateway metrics"
echo "  curl -s http://localhost:$GATEWAY_PORT/metrics | grep '^gateway_'"
echo ""
echo "  # Trigger upstream errors to drive gateway_upstream_errors_total"
echo "  curl -s -X POST http://localhost:$METRICS_ORDERS_ADMIN_PORT/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"failing\"}' | jq"
echo "  sleep 11 && curl -s http://localhost:$GATEWAY_PORT/metrics-orders | jq"
echo "  curl -s http://localhost:$GATEWAY_PORT/metrics | grep gateway_upstream_errors_total"
echo ""
echo "  # Restore"
echo "  curl -s -X POST http://localhost:$METRICS_ORDERS_ADMIN_PORT/mode \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"mode\":\"healthy\"}' | jq"
echo ""
echo "─────────────────────────────────────────────────────────────────────"
echo ""

wait "$GATEWAY_PID"
