#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$USERS_PID" "$PRODUCTS_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$USERS_PID" "$PRODUCTS_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/basic/upstream-users.js" &
USERS_PID=$!

node "$ROOT/examples/basic/upstream-products.js" &
PRODUCTS_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/basic/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

echo ""
echo "All services are running. Press Ctrl+C to stop."
echo ""
echo "  Gateway       →  http://localhost:3000"
echo "  Health check  →  http://localhost:3000/health"
echo "  Users API     →  http://localhost:3000/users"
echo "  Products API  →  http://localhost:3000/products"
echo ""

wait "$GATEWAY_PID"
