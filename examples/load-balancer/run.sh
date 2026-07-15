#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$CATALOG_A_PID" "$CATALOG_B_PID" "$CATALOG_C_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$CATALOG_A_PID" "$CATALOG_B_PID" "$CATALOG_C_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream instances..."
CATALOG_PORT=4010 CATALOG_INSTANCE=A node "$ROOT/examples/load-balancer/upstream-catalog.js" &
CATALOG_A_PID=$!

CATALOG_PORT=4011 CATALOG_INSTANCE=B node "$ROOT/examples/load-balancer/upstream-catalog.js" &
CATALOG_B_PID=$!

CATALOG_PORT=4012 CATALOG_INSTANCE=C node "$ROOT/examples/load-balancer/upstream-catalog.js" &
CATALOG_C_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/load-balancer/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "  Upstream instances"
echo "  ──────────────────────────────────────────────────────────"
echo "  Catalog A  →  http://localhost:4010  (direct, weight 1)"
echo "  Catalog B  →  http://localhost:4011  (direct, weight 2)"
echo "  Catalog C  →  http://localhost:4012  (direct, weight 1)"
echo ""
echo "  Gateway routes"
echo "  ┌──────────────────────┬─────────────────────┬────────────────────────────────────────────┐"
echo "  │ /catalog/rr          │ round-robin         │ A → B → C → A → …                         │"
echo "  │ /catalog/weighted    │ weighted            │ A×1 B×2 C×1 per 4-request cycle            │"
echo "  │ /catalog/lc          │ least-connections   │ always forwards to the least-busy instance │"
echo "  └──────────────────────┴─────────────────────┴────────────────────────────────────────────┘"
echo ""
echo "  Each response includes { instance, port } so you can see which upstream was chosen."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " W A L K T H R O U G H"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── Round-robin ─────────────────────────────────────────────"
echo ""
echo "  # Each request goes to the next instance in sequence."
echo "  # You should see A → B → C → A in the 'instance' field."
echo "  for i in 1 2 3 4; do"
echo "    curl -s http://localhost:3000/catalog/rr | jq '{ instance, port }'"
echo "  done"
echo ""
echo "── Weighted (A×1 B×2 C×1 per cycle) ──────────────────────"
echo ""
echo "  # Over 4 requests the pattern is A B B C (then repeats)."
echo "  # Instance B carries twice as much traffic as A or C."
echo "  for i in 1 2 3 4 5 6 7 8; do"
echo "    curl -s http://localhost:3000/catalog/weighted | jq -r '.instance'"
echo "  done"
echo ""
echo "── Least-connections ────────────────────────────────────────"
echo ""
echo "  # With sequential requests (one completes before the next starts)"
echo "  # all three instances look equally idle, so the gateway falls back"
echo "  # to visiting them in order."
echo "  for i in 1 2 3; do"
echo "    curl -s http://localhost:3000/catalog/lc | jq '{ instance, port }'"
echo "  done"
echo ""
echo "  # To see least-connections actually differentiate, send concurrent"
echo "  # requests so multiple connections are open at the same time:"
echo "  curl -s http://localhost:3000/catalog/lc &"
echo "  curl -s http://localhost:3000/catalog/lc &"
echo "  curl -s http://localhost:3000/catalog/lc &"
echo "  wait"
echo ""
echo "── Create a product on a specific instance ─────────────────"
echo ""
echo "  # The request lands on whatever instance the strategy picks."
echo "  curl -s -X POST http://localhost:3000/catalog/rr \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\":\"Turbo Widget\",\"price\":99.99}' | jq"
echo ""
echo "── Direct access (bypass gateway) ─────────────────────────"
echo ""
echo "  # Hit each instance directly to confirm they are all running."
echo "  curl -s http://localhost:4010 | jq '{ instance, port }'"
echo "  curl -s http://localhost:4011 | jq '{ instance, port }'"
echo "  curl -s http://localhost:4012 | jq '{ instance, port }'"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

wait "$GATEWAY_PID"
