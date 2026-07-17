#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup() {
  echo ""
  echo "Shutting down all services..."
  kill "$CATALOG_PID" "$GATEWAY_PID" 2>/dev/null || true
  wait "$CATALOG_PID" "$GATEWAY_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

echo "Starting upstream services..."
node "$ROOT/examples/cache/upstream-catalog.js" &
CATALOG_PID=$!

echo "Starting gateway..."
cp "$ROOT/examples/cache/.env" "$ROOT/.env"
cd "$ROOT" && pnpm dev &
GATEWAY_PID=$!

sleep 2

echo ""
echo "  Services"
echo "  ──────────────────────────────────────────────────────────"
echo "  Gateway (public)   →  http://localhost:3000"
echo "  Health check       →  http://localhost:3000/health"
echo "  Catalog API        →  http://localhost:3000/catalog  ← cache enabled"
echo "  ──────────────────────────────────────────────────────────"
echo ""
echo "  Cache config (routes.json)"
echo "    ttl          30 000 ms  (30 seconds)"
echo "    methods      GET, HEAD"
echo "    statusCodes  200"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " W A L K T H R O U G H"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "── Step 1 · First request (cache MISS) ────────────────────────"
echo ""
echo "  # The gateway forwards to the upstream (200 ms latency)."
echo "  # Response includes  X-Cache: MISS  and  X-Request-Count: 1"
echo "  curl -si http://localhost:3000/catalog | grep -E 'X-Cache|X-Request-Count'"
echo ""
echo "── Step 2 · Repeated requests (cache HIT) ─────────────────────"
echo ""
echo "  # Instant responses from cache. X-Cache: HIT, X-Request-Count stays at 1"
echo "  # because the upstream is never called again."
echo "  curl -si http://localhost:3000/catalog | grep -E 'X-Cache|X-Request-Count'"
echo "  curl -si http://localhost:3000/catalog | grep -E 'X-Cache|X-Request-Count'"
echo ""
echo "── Step 3 · Different URL → different cache entry ─────────────"
echo ""
echo "  # Cache key is per-URL — /catalog/1 is cached independently of /catalog"
echo "  curl -si http://localhost:3000/catalog/1 | grep -E 'X-Cache|X-Request-Count'"
echo "  curl -si http://localhost:3000/catalog/1 | grep -E 'X-Cache|X-Request-Count'"
echo ""
echo "── Step 4 · POST is not cached ────────────────────────────────"
echo ""
echo "  # POST /catalog creates a product and always hits the upstream"
echo "  curl -si -X POST http://localhost:3000/catalog \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\":\"New Widget\",\"price\":19.99}' | grep -E 'X-Cache|HTTP'"
echo ""
echo "── Step 5 · Wait for TTL expiry ───────────────────────────────"
echo ""
echo "  # After 30 s the cache entry expires — the next GET is a MISS again"
echo "  sleep 31 && curl -si http://localhost:3000/catalog | grep -E 'X-Cache|X-Request-Count'"
echo ""
echo "── Tips ────────────────────────────────────────────────────────"
echo ""
echo "  Compare response times (cache miss vs hit):"
echo "    time curl -s http://localhost:3000/catalog > /dev/null   # first: ~200 ms"
echo "    time curl -s http://localhost:3000/catalog > /dev/null   # second: <5 ms"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

wait "$GATEWAY_PID"
