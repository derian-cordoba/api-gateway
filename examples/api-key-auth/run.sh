#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$REPORTS_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$REPORTS_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/api-key-auth/upstream-reports.js" &
REPORTS_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/api-key-auth/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "All services are running. Press Ctrl+C to stop."
echo ""
echo "  Gateway       →  http://localhost:3002"
echo "  Health check  →  http://localhost:3002/health"
echo "  Reports API   →  http://localhost:3002/reports  (API key protected)"
echo ""
echo "  Valid keys:   x-api-key: key-service-alpha-123"
echo "                x-api-key: key-service-beta-456"
echo ""
echo "─────────────────────────────────────────────────────"
echo " Try it out"
echo "─────────────────────────────────────────────────────"
echo ""
echo "1. Request without a key (expect 401):"
echo "   curl -s http://localhost:3002/reports | jq"
echo ""
echo "2. Request with an invalid key (expect 401):"
echo "   curl -s http://localhost:3002/reports \\"
echo "     -H 'x-api-key: wrong-key' | jq"
echo ""
echo "3. Request with a valid key (expect 200):"
echo "   curl -s http://localhost:3002/reports \\"
echo "     -H 'x-api-key: key-service-alpha-123' | jq"
echo ""
echo "4. Sales breakdown:"
echo "   curl -s http://localhost:3002/reports/sales \\"
echo "     -H 'x-api-key: key-service-beta-456' | jq"
echo ""
echo "5. User acquisition stats:"
echo "   curl -s http://localhost:3002/reports/users \\"
echo "     -H 'x-api-key: key-service-alpha-123' | jq"
echo "─────────────────────────────────────────────────────"
echo ""

wait "$GATEWAY_PID"
