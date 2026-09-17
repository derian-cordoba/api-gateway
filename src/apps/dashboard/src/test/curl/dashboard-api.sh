#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FIXTURE_PATH="$SCRIPT_DIR/fixtures/mock-routes.json"
TEST_PORT="${DASHBOARD_TEST_PORT:-3101}"
BASE_URL="http://127.0.0.1:$TEST_PORT"
TEST_TOKEN="dashboard-curl-test-token"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gateway-dashboard-curl.XXXXXX")"
ROUTES_PATH="$TEST_DIR/routes.json"
RESPONSE_PATH="$TEST_DIR/response.json"
HEADERS_PATH="$TEST_DIR/headers.txt"
SERVER_LOG_PATH="$TEST_DIR/dashboard.log"
SERVER_PID=""
PASSED=0

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT INT TERM

pass() {
  PASSED=$((PASSED + 1))
  echo "ok $PASSED - $1"
}

fail() {
  echo "not ok - $1" >&2
  if [[ -f "$RESPONSE_PATH" ]]; then
    sed -n '1,120p' "$RESPONSE_PATH" >&2
  fi
  if [[ -f "$SERVER_LOG_PATH" ]]; then
    echo "Dashboard log:" >&2
    sed -n '1,160p' "$SERVER_LOG_PATH" >&2
  fi
  exit 1
}

expect_status() {
  local expected="$1"
  local actual="$2"
  local description="$3"
  [[ "$actual" == "$expected" ]] || fail "$description: expected HTTP $expected, received $actual"
  pass "$description"
}

assert_json() {
  local expression="$1"
  local description="$2"
  node -e '
    const fs = require("node:fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const expression = process.argv[2];
    if (!Function("payload", `return Boolean(${expression})`)(payload)) process.exit(1);
  ' "$RESPONSE_PATH" "$expression" || fail "$description"
  pass "$description"
}

authorized_curl() {
  curl -sS \
    -H "X-Dashboard-Token: $TEST_TOKEN" \
    "$@"
}

cp "$FIXTURE_PATH" "$ROUTES_PATH"

cd "$DASHBOARD_DIR"
ROUTES_FILE_PATH="$ROUTES_PATH" \
DASHBOARD_TOKEN="$TEST_TOKEN" \
pnpm exec next start --port "$TEST_PORT" >"$SERVER_LOG_PATH" 2>&1 &
SERVER_PID=$!

for _attempt in {1..40}; do
  if curl -sS -o /dev/null "$BASE_URL/routes" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

kill -0 "$SERVER_PID" 2>/dev/null || fail "dashboard server did not start"

STATUS="$(curl -sS -o "$RESPONSE_PATH" -w '%{http_code}' "$BASE_URL/api/config")"
expect_status 401 "$STATUS" "configuration rejects missing token"
assert_json 'payload.error === "Unauthorized"' "unauthorized response is structured"

STATUS="$(authorized_curl -o "$RESPONSE_PATH" -w '%{http_code}' "$BASE_URL/api/config")"
expect_status 200 "$STATUS" "configuration returns mock routes"
assert_json 'payload.routes.length === 2' "configuration contains two routes"
assert_json 'payload.routes[0].baseURL === "/mock/catalog"' "catalog route is returned"
assert_json 'typeof payload.revision === "string" && payload.revision.length === 16' "configuration includes a revision"

REVISION="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).revision)' "$RESPONSE_PATH")"

STATUS="$(curl -sS -o "$RESPONSE_PATH" -w '%{http_code}' "$BASE_URL/api/schema")"
expect_status 200 "$STATUS" "schema metadata is available"
assert_json 'payload.sections.some((section) => section.id === "authentication")' "schema lists authentication"

STATUS="$(authorized_curl -o "$RESPONSE_PATH" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data-binary "@$FIXTURE_PATH" \
  "$BASE_URL/api/config/validate")"
expect_status 200 "$STATUS" "valid mock routes pass validation"
assert_json 'payload.success === true && payload.routes.length === 2' "successful validation returns normalized routes"

STATUS="$(authorized_curl -o "$RESPONSE_PATH" -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  --data-binary '[{"baseURL":"invalid","proxy":{}}]' \
  "$BASE_URL/api/config/validate")"
expect_status 422 "$STATUS" "invalid routes fail validation"
assert_json 'payload.success === false && payload.issues.length > 0' "validation failure includes issues"

node -e '
  const fs = require("node:fs");
  const routes = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  routes.push({ baseURL: "/mock/health", proxy: { target: "http://localhost:4300" } });
  fs.writeFileSync(process.argv[2], JSON.stringify({ routes, expectedRevision: process.argv[3] }));
' "$FIXTURE_PATH" "$TEST_DIR/update.json" "$REVISION"

STATUS="$(authorized_curl -o "$RESPONSE_PATH" -w '%{http_code}' \
  -X PUT \
  -H 'Content-Type: application/json' \
  --data-binary "@$TEST_DIR/update.json" \
  "$BASE_URL/api/config")"
expect_status 200 "$STATUS" "configuration update succeeds"
assert_json 'payload.routes.length === 3' "configuration update adds the health route"
assert_json 'payload.revision !== "'"$REVISION"'"' "configuration update changes the revision"

STATUS="$(authorized_curl -o "$RESPONSE_PATH" -w '%{http_code}' \
  -X PUT \
  -H 'Content-Type: application/json' \
  --data-binary "@$TEST_DIR/update.json" \
  "$BASE_URL/api/config")"
expect_status 409 "$STATUS" "stale revision is rejected"
assert_json 'payload.error === "Revision conflict"' "revision conflict response is structured"

STATUS="$(authorized_curl -o "$RESPONSE_PATH" -w '%{http_code}' "$BASE_URL/api/status")"
expect_status 200 "$STATUS" "status endpoint responds"
assert_json 'payload.status === "ready" && payload.storage === "local-json"' "status reports the local JSON driver"
assert_json 'payload.routeCount === 3' "status reports the updated route count"

STATUS="$(authorized_curl -D "$HEADERS_PATH" -o "$RESPONSE_PATH" -w '%{http_code}' "$BASE_URL/api/config/export")"
expect_status 200 "$STATUS" "configuration export succeeds"
assert_json 'Array.isArray(payload) && payload.length === 3' "export contains the complete route array"
grep -qi 'content-disposition: attachment; filename="routes.json"' "$HEADERS_PATH" || fail "export sets an attachment filename"
pass "export sets an attachment filename"

echo "1..$PASSED"
