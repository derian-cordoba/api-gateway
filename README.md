# API Gateway

A generic, configuration-driven HTTP API gateway. Routes incoming requests to upstream services via a JSON config file or environment variable, with per-route rate limiting, authentication, circuit breaking, IP filtering, request ID propagation, structured logging, and full security headers out of the box.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Route Configuration](#route-configuration)
- [Authentication](#authentication)
  - [JWT](#jwt)
  - [API Key](#api-key)
- [Circuit Breaker](#circuit-breaker)
- [Request ID Propagation](#request-id-propagation)
- [IP Allowlist / Blocklist](#ip-allowlist--blocklist)
- [Running the Gateway](#running-the-gateway)
- [Health Check](#health-check)
- [Project Structure](#project-structure)
- [Example Projects](#example-projects)
- [Architecture](#architecture)

---

## Features

- **Configuration-driven routing** — define proxy routes in a JSON file, an environment variable, or both; changes take effect on restart with zero code changes
- **Per-route authentication** — protect any route with a JWT Bearer token (HMAC or RSA/EC) or an API key; set `enabled: false` to bypass with zero overhead
- **Per-route rate limiting** — each route can declare its own `max` requests / `windowMs` window, enforced by `express-rate-limit`
- **Per-route circuit breaker** — automatically stops forwarding to a failing upstream after a configurable failure threshold, returning `503` until the service recovers; prevents cascading failures across your stack
- **Request ID propagation** — every request receives a `X-Request-ID` header (generated UUID v4 if absent, forwarded unchanged if already set); the same ID appears in the response header, every gateway log line, and the request forwarded to the upstream — enabling end-to-end request tracing with no external infrastructure
- **IP allowlist / blocklist** — per-route IPv4 and CIDR-range filtering; deny list is evaluated first, allow list restricts access to specified addresses only; IPv4-mapped IPv6 addresses are normalised automatically
- **Startup validation** — route config is validated with Zod at boot time; the process exits with a descriptive error rather than silently misbehaving
- **Structured logging** — `pino` + `pino-http` emit newline-delimited JSON in production and human-readable output (via `pino-pretty`) in development
- **Security headers** — full `helmet` defaults applied to every response (`CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, etc.)
- **Configurable CORS** — origins, methods, and allowed headers controlled via environment variables
- **Health check endpoint** — `GET /health` returns uptime, version, and timestamp; always available regardless of configured routes
- **Optional URL prefix** — mount all routes under a shared prefix (e.g. `/api/v1`) via `GATEWAY_PREFIX`
- **Body forwarding** — JSON bodies on `POST`, `PUT`, and `PATCH` requests are correctly forwarded to upstreams (`fixRequestBody`)
- **Graceful shutdown** — `SIGINT` and `uncaughtException` handlers stop the server cleanly before exiting

---

## Requirements

- Node.js 18+
- pnpm 10+

---

## Getting Started

```bash
# 1. Clone and install
git clone <repo-url>
cd api-gateway
pnpm install

# 2. Create your env file
cp .env.example .env

# 3. Create a routes config (see Route Configuration below)
cp examples/basic/routes.json routes.json   # or write your own

# 4. Start in development mode (hot-reload)
pnpm dev
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and edit as needed.

#### Server

| Variable | Default | Description |
|---|---|---|
| `GATEWAY_PORT` | `3000` | Port the gateway listens on. Takes priority over `PORT`. |
| `PORT` | `3000` | Fallback port when `GATEWAY_PORT` is not set. |
| `GATEWAY_PREFIX` | _(none)_ | Optional path prefix for all routes. Example: `/api/v1` makes proxy routes reachable at `/api/v1/<baseURL>` and the health check at `/api/v1/health`. |

#### Logging

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` to disable `pino-pretty` and emit newline-delimited JSON. |
| `LOG_LEVEL` | `info` | Pino log level: `trace` · `debug` · `info` · `warn` · `error` · `fatal`. |

#### CORS

| Variable | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `*` | Comma-separated list of allowed origins. Use `*` to allow all. |
| `CORS_METHODS` | `GET,POST,PUT,DELETE,PATCH,OPTIONS` | Comma-separated list of allowed HTTP methods. |
| `CORS_HEADERS` | `Content-Type,Authorization` | Comma-separated list of allowed request headers. |

#### Routes

| Variable | Default | Description |
|---|---|---|
| `ROUTES_FILE_PATH` | `routes.json` | Path to the JSON route config file, relative to `process.cwd()`. |
| `ROUTES` | _(none)_ | Inline route definitions as a JSON array. Merged with `ROUTES_FILE_PATH`. Useful for containerised deployments where injecting a file is inconvenient. |

#### Authentication

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | _(none)_ | Fallback HMAC signing secret used when a JWT route has no inline `secret` field. |
| `JWT_PUBLIC_KEY` | _(none)_ | Fallback PEM public key used when a JWT route has no inline `publicKey` field. Takes precedence over `JWT_SECRET`. |

---

### Route Configuration

Routes are defined as a JSON array. Each entry is a **Gateway** object:

```ts
{
  baseURL:         string          // required — path prefix to match, must start with "/"
  proxy:           Proxy          // required — upstream proxy settings
  rateLimit?:      RateLimit      // optional — per-route rate limiting
  auth?:           Auth           // optional — per-route authentication
  circuitBreaker?: CircuitBreaker // optional — per-route circuit breaker
  ipFilter?:       IpFilter       // optional — per-route IP allowlist / blocklist
}
```

#### `Proxy`

| Field | Type | Required | Description |
|---|---|---|---|
| `target` | `string` | ✅ | Target upstream URL (must be a valid URL). |
| `changeOrigin` | `boolean` | — | Rewrite the `Host` header to the target origin. |
| `pathRewrite` | `{ [pattern]: replacement }` | — | Regex path rewrite rules applied before forwarding. |
| `headers` | `{ [name]: value }` | — | Extra headers added to every forwarded request. |
| `isSecure` | `boolean` | — | Verify the upstream TLS certificate. |
| `method` | `string` | — | Override the HTTP method forwarded to the upstream. |
| `timeout` | `number` | — | Proxy request timeout in milliseconds. |

#### `RateLimit`

| Field | Type | Required | Description |
|---|---|---|---|
| `max` | `number` | ✅ | Maximum number of requests allowed per window. |
| `windowMs` | `number` | ✅ | Time window in milliseconds. |
| `statusCode` | `number` | — | HTTP status returned when the limit is exceeded (default: `429`). |
| `message` | `string` | — | Response message when the limit is exceeded (default: `"Too many requests"`). |

Responses include standard `RateLimit-*` headers (RFC draft-8).

#### `Auth`

Adds authentication middleware to a route. When `enabled` is `false` the middleware is a no-op passthrough — no overhead, no token check.

Two strategies are supported, selected with the `strategy` field.

**`"jwt"` — Bearer token validation**

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | `boolean` | ✅ | `true` to enforce, `false` to bypass. |
| `strategy` | `"jwt"` | ✅ | — |
| `secret` | `string` | — | Shared secret for HMAC algorithms (HS256, HS384, HS512). Falls back to `JWT_SECRET` env var. |
| `publicKey` | `string` | — | PEM-encoded public key or X.509 certificate for asymmetric algorithms (RS256, RS384, RS512, ES256 …). Falls back to `JWT_PUBLIC_KEY` env var. Takes precedence over `secret` when both are present. |
| `algorithms` | `string[]` | — | Explicit algorithm allowlist. Defaults to `["RS256"]` when `publicKey` is used, `["HS256"]` otherwise. Recommended to prevent algorithm-confusion attacks. |

**`"apiKey"` — Header-based API key**

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | `boolean` | ✅ | `true` to enforce, `false` to bypass. |
| `strategy` | `"apiKey"` | ✅ | — |
| `keys` | `string[]` | ✅ | List of valid API keys. At least one entry required. |
| `header` | `string` | — | Header name to read the key from (default: `x-api-key`). |

#### `CircuitBreaker`

Stops forwarding requests to a failing upstream after a configurable number of consecutive failures and returns `503 Service Unavailable` until the upstream recovers. See [Circuit Breaker](#circuit-breaker) for a full explanation.

| Field | Type | Required | Description |
|---|---|---|---|
| `threshold` | `number` | ✅ | Consecutive failures before the circuit opens. Must be a positive integer. |
| `timeout` | `number` | ✅ | Milliseconds the circuit stays open before transitioning to half-open and sending a probe request. |
| `successThreshold` | `number` | — | Consecutive probe successes required to close the circuit (default: `1`). |

#### `IpFilter`

Restricts access to a route based on the client's IP address. At least one of `allow` or `deny` must be provided. See [IP Allowlist / Blocklist](#ip-allowlist--blocklist) for a full explanation.

| Field | Type | Required | Description |
|---|---|---|---|
| `allow` | `string[]` | — | IPv4 addresses or CIDR ranges that are explicitly allowed. When set, only listed IPs can access the route. At least one entry required. |
| `deny` | `string[]` | — | IPv4 addresses or CIDR ranges that are explicitly blocked. Evaluated before `allow` — a match returns `403` immediately. At least one entry required. |

Both fields accept plain IPv4 addresses (`192.168.1.1`) and CIDR notation (`10.0.0.0/8`). IPv4-mapped IPv6 addresses (`::ffff:192.168.1.1`) are normalised to their IPv4 form before matching, so you never need to list both forms.

#### Example `routes.json`

```json
[
  {
    "baseURL": "/users",
    "proxy": {
      "target": "http://users-service:3001",
      "changeOrigin": true,
      "pathRewrite": { "^/users": "" }
    },
    "rateLimit": {
      "max": 100,
      "windowMs": 60000,
      "statusCode": 429,
      "message": "Too many requests. Please try again in a minute."
    }
  },
  {
    "baseURL": "/orders",
    "proxy": {
      "target": "http://orders-service:3002",
      "changeOrigin": true,
      "pathRewrite": { "^/orders": "" }
    },
    "auth": {
      "enabled": true,
      "strategy": "jwt"
    }
  },
  {
    "baseURL": "/reports",
    "proxy": {
      "target": "http://reports-service:3003",
      "changeOrigin": true,
      "pathRewrite": { "^/reports": "" }
    },
    "auth": {
      "enabled": true,
      "strategy": "apiKey",
      "keys": ["key-service-alpha-123", "key-service-beta-456"]
    }
  },
  {
    "baseURL": "/payments",
    "proxy": {
      "target": "http://payments-service:3004",
      "changeOrigin": true,
      "pathRewrite": { "^/payments": "" }
    },
    "circuitBreaker": {
      "threshold": 5,
      "timeout": 30000,
      "successThreshold": 1
    }
  },
  {
    "baseURL": "/internal/metrics",
    "proxy": {
      "target": "http://metrics-service:3005",
      "changeOrigin": true,
      "pathRewrite": { "^/internal/metrics": "" }
    },
    "ipFilter": {
      "allow": ["10.0.0.0/8", "172.16.0.0/12"]
    }
  }
]
```

Config is validated with [Zod](https://zod.dev) at startup. If any route is invalid the process exits immediately with a detailed per-field error message.

Routes are loaded from two sources at startup and **merged**:

1. `ROUTES_FILE_PATH` — JSON file on disk (missing file is a warning, not an error)
2. `ROUTES` — JSON array in an environment variable

---

## Authentication

Authentication is optional and configured per route via the `auth` field. The middleware is applied before rate limiting and proxying. When `enabled: false` the handler is a single no-op function — zero overhead on unprotected routes.

### JWT

Protect a route with a Bearer token. The gateway validates the token signature; your upstream receives the request only if verification passes.

```json
{
  "baseURL": "/orders",
  "proxy": { "target": "http://orders-service:3002", "changeOrigin": true },
  "auth": {
    "enabled": true,
    "strategy": "jwt"
  }
}
```

The signing key is resolved in this order:

1. `publicKey` field in the route config (PEM — use for RS256 / ES256)
2. `JWT_PUBLIC_KEY` environment variable
3. `secret` field in the route config (string — use for HS256)
4. `JWT_SECRET` environment variable

`publicKey` always takes precedence over `secret`. If neither is present the gateway returns `401`.

**HMAC (HS256) — shared secret:**

```bash
# .env
JWT_SECRET=super-secret-key-change-in-production
```

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}' | jq -r '.token')

curl http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN"
```

**RSA (RS256) — public/private key pair:**

```json
{
  "auth": {
    "enabled": true,
    "strategy": "jwt",
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----",
    "algorithms": ["RS256"]
  }
}
```

### API Key

Protect a route with a pre-shared key delivered in a request header.

```json
{
  "baseURL": "/reports",
  "proxy": { "target": "http://reports-service:3003", "changeOrigin": true },
  "auth": {
    "enabled": true,
    "strategy": "apiKey",
    "header": "x-api-key",
    "keys": ["key-service-alpha-123", "key-service-beta-456"]
  }
}
```

```bash
# Valid key → 200
curl http://localhost:3000/reports \
  -H "x-api-key: key-service-alpha-123"

# Missing or wrong key → 401
curl http://localhost:3000/reports
```

Multiple keys in `keys` let you rotate credentials without downtime — add the new key, deploy, then remove the old one.

---

## Circuit Breaker

The circuit breaker protects your gateway from cascading failures. When an upstream service becomes unhealthy, the gateway detects the pattern, opens the circuit, and rejects subsequent requests immediately — without adding load to an already-struggling upstream.

### State machine

```
              threshold failures
  CLOSED ────────────────────────► OPEN
    ▲                                │
    │ successThreshold successes     │ timeout elapses
    │                                ▼
  HALF-OPEN ◄─────────────────── (probe)
              1 probe request let through
```

| State | Behaviour |
|---|---|
| **CLOSED** | Normal operation. Failures are counted; successful responses reset the counter. |
| **OPEN** | All requests are rejected immediately with `503 Service Unavailable` and a `Retry-After` header. The upstream is not contacted. |
| **HALF-OPEN** | After `timeout` ms the circuit allows one probe request through. A successful response closes the circuit; any failure re-opens it with a fresh timeout. |

Both **5xx HTTP responses** and **network-level errors** (e.g. `ECONNREFUSED`, `ETIMEDOUT`) count as failures.

### Configuration

```json
{
  "baseURL": "/payments",
  "proxy": {
    "target": "http://payments-service:3004",
    "changeOrigin": true,
    "pathRewrite": { "^/payments": "" }
  },
  "circuitBreaker": {
    "threshold": 5,
    "timeout": 30000,
    "successThreshold": 1
  }
}
```

### Responses

**Circuit OPEN — `503 Service Unavailable`:**

```
HTTP/1.1 503 Service Unavailable
Retry-After: 28
Content-Type: application/json

{
  "error": "Service Unavailable",
  "message": "Circuit breaker open — upstream is not responding"
}
```

The `Retry-After` header tells clients how many seconds remain before the circuit transitions to half-open.

**Upstream network error — `502 Bad Gateway`:**

```json
{
  "error": "Bad Gateway",
  "message": "Upstream service is unavailable"
}
```

### Gateway log output

State transitions are logged at the `warn` / `info` level so you can observe the circuit breaker lifecycle without instrumenting your upstreams:

```
WARN  Circuit breaker opened, upstream failing   { baseURL: "/payments", retryAfterSeconds: 30 }
WARN  Circuit breaker half-open, probing upstream { baseURL: "/payments" }
INFO  Circuit breaker closed, upstream recovered  { baseURL: "/payments" }
```

### Combining with rate limiting

Circuit breaking and rate limiting are independent and can be applied to the same route. Rate limiting runs first:

```json
{
  "baseURL": "/payments",
  "proxy": { "target": "http://payments-service:3004", "changeOrigin": true },
  "rateLimit": { "max": 200, "windowMs": 60000 },
  "circuitBreaker": { "threshold": 5, "timeout": 30000 }
}
```

---

## Request ID Propagation

Every request that passes through the gateway is assigned a unique `X-Request-ID` header. This ID ties together the gateway log line, the request forwarded to the upstream, and the response returned to the caller — letting you trace any individual request across your entire stack with a single value.

### Behaviour

| Scenario | Result |
|---|---|
| Client sends no `X-Request-ID` header | Gateway generates a UUID v4 and injects it |
| Client sends `X-Request-ID: <value>` | Gateway forwards the existing value unchanged |

In both cases the final ID is:
- set on `req.headers` so it is forwarded to the upstream in the proxy request
- echoed in the `X-Request-ID` **response** header so callers can log it
- used as `req.id` in every `pino-http` log line for that request

No route configuration is required — propagation is automatic for every route.

### Gateway log correlation

```
INFO  incoming request  { "req": { "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "method": "GET", "url": "/orders" } }
INFO  request completed { "req": { "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }, "res": { "statusCode": 200 } }
```

### Usage

```bash
# Gateway generates a UUID — echoed in the response header
curl -si http://localhost:3000/inventory | grep -i x-request-id
# X-Request-ID: f47ac10b-58cc-4372-a567-0e02b2c3d479

# Supply your own ID — forwarded unchanged
curl -si http://localhost:3000/inventory \
  -H "X-Request-ID: my-trace-abc-123" | grep -i x-request-id
# X-Request-ID: my-trace-abc-123
```

---

## IP Allowlist / Blocklist

Restrict access to any route by the client's IP address. Both exact IPv4 addresses and CIDR ranges are supported. `deny` and `allow` can be combined on the same route.

### Evaluation order

```
1. deny  — if the client IP matches any deny entry → 403 Forbidden (stop)
2. allow — if set and the client IP does not match any allow entry → 403 Forbidden (stop)
3.        — request is forwarded to the upstream
```

When only `deny` is configured every IP passes except those explicitly blocked.  
When only `allow` is configured only listed IPs pass.  
When both are present `deny` takes precedence.

### Configuration

```json
{
  "baseURL": "/internal/metrics",
  "proxy": { "target": "http://metrics-service:3005", "changeOrigin": true },
  "ipFilter": {
    "allow": ["10.0.0.0/8", "172.16.0.0/12"]
  }
}
```

```json
{
  "baseURL": "/public-api",
  "proxy": { "target": "http://api-service:3006", "changeOrigin": true },
  "ipFilter": {
    "deny": ["203.0.113.0/24"]
  }
}
```

### Response when blocked

```
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden",
  "message": "Your IP address is not permitted to access this resource"
}
```

The upstream never receives the request — filtering happens in the gateway middleware before the proxy is invoked.

### IPv6 normalisation

IPv4-mapped IPv6 addresses (`::ffff:192.168.1.1`) are silently normalised to their IPv4 form before matching. You only need to list the IPv4 address in the config — both forms are covered automatically.

### Combining with other features

IP filtering runs as the **first middleware** on a route, before authentication and rate limiting. A blocked request never reaches the auth check and does not count against rate limit counters.

```json
{
  "baseURL": "/admin",
  "proxy": { "target": "http://admin-service:3007", "changeOrigin": true },
  "ipFilter": { "allow": ["10.0.0.0/8"] },
  "auth": { "enabled": true, "strategy": "apiKey", "keys": ["admin-key-xyz"] },
  "rateLimit": { "max": 50, "windowMs": 60000 }
}
```

---

## Running the Gateway

### Development (hot-reload)

```bash
pnpm dev
```

Uses `ts-node-dev` to transpile on the fly and restart on file changes. Logs are pretty-printed via `pino-pretty`.

### Production

```bash
# Compile TypeScript
pnpm build

# Run the compiled output
pnpm start
```

In production (`NODE_ENV=production`) logs are emitted as newline-delimited JSON suitable for log aggregators (Datadog, Loki, CloudWatch, etc.).

---

## Health Check

The gateway exposes a built-in health check endpoint that is always available, independent of the configured proxy routes.

```
GET /health
```

If `GATEWAY_PREFIX` is set, the endpoint is available at `<GATEWAY_PREFIX>/health`.

**Response `200 OK`:**

```json
{
  "status": "ok",
  "uptime": 42,
  "version": "1.0.0",
  "timestamp": "2026-06-18T00:00:00.000Z"
}
```

| Field | Description |
|---|---|
| `status` | Always `"ok"` when the process is alive. |
| `uptime` | Seconds since the gateway process started. |
| `version` | Value of `npm_package_version` (set automatically by npm/pnpm). |
| `timestamp` | ISO 8601 timestamp of the response. |

---

## Project Structure

```
src/apps/api-gateway/
├── index.ts                  # Entry point — bootstraps the app, registers process signals
├── App.ts                    # Thin lifecycle wrapper (start / stop)
├── Server.ts                 # HTTP server creation and prefix mounting
├── logger.ts                 # Pino logger singleton
│
├── config/
│   ├── app-env.ts            # Aggregates all config modules into a single AppEnv object
│   ├── env/config.ts         # NODE_ENV → isDev flag
│   ├── gateway/config.ts     # GATEWAY_PORT, GATEWAY_PREFIX
│   ├── cors/config.ts        # CORS_ORIGINS, CORS_METHODS, CORS_HEADERS
│   ├── routes/config.ts      # ROUTES_FILE_PATH
│   └── auth/config.ts        # JWT_SECRET, JWT_PUBLIC_KEY
│
├── middleware/
│   ├── requestId.ts          # X-Request-ID generation and forwarding
│   ├── ipFilter.ts           # Per-route IPv4 allowlist / blocklist
│   ├── authMiddleware.ts     # Factory — returns the right strategy or a no-op
│   ├── auth/
│   │   ├── AuthStrategy.ts       # Interface (Strategy pattern)
│   │   ├── JwtAuthStrategy.ts    # JWT Bearer token validation (HMAC + RSA/EC)
│   │   └── ApiKeyAuthStrategy.ts # Header-based API key validation
│   └── circuit-breaker/
│       ├── CircuitBreaker.ts             # Three-state machine (CLOSED / OPEN / HALF-OPEN)
│       └── CircuitBreakerProxyHandlers.ts # Proxy event handlers — records success/failure
│
├── routes/
│   ├── Router.ts             # Middleware pipeline (logging → security → CORS → body → proxy → errors)
│   ├── ProxyManager.ts       # Reads, validates, and registers proxy routes
│   ├── RouteValidator.ts     # Validates route config and delegates to schema modules
│   ├── HealthRouter.ts       # GET /health handler
│   └── validators/           # One Zod schema per domain
│       ├── proxy.schema.ts
│       ├── rate-limit.schema.ts
│       ├── auth.schema.ts
│       ├── circuit-breaker.schema.ts
│       ├── ip-filter.schema.ts
│       └── gateway.schema.ts
│
└── types/
    ├── gateway.d.ts          # Gateway type
    ├── proxy.d.ts            # Proxy type
    ├── rate-limit.d.ts       # RateLimit type
    ├── auth.d.ts             # Auth type (JwtAuth | ApiKeyAuth)
    ├── circuit-breaker.d.ts  # CircuitBreakerConfig type
    └── ip-filter.d.ts        # IpFilter type
```

---

## Example Projects

`examples/` contains self-contained demos that start upstream services and a gateway covering all features.

### Run all examples together

```bash
pnpm example
```

Copies `examples/.env` to the project root and starts all services. Once running:

| Endpoint | Feature | Description |
|---|---|---|
| `http://localhost:3000/health` | — | Gateway health check |
| `http://localhost:3000/users` | Rate limiting | Users service |
| `http://localhost:3000/products` | Rate limiting | Products service |
| `http://localhost:3000/auth/login` | — | Issues JWT tokens |
| `http://localhost:3000/orders` | JWT auth | Orders service |
| `http://localhost:3000/reports` | API key auth | Reports service |
| `http://localhost:3000/payments` | Circuit breaker | Payments service |
| `http://localhost:3000/inventory` | Request ID | Inventory service — echoes the forwarded ID |
| `http://localhost:3000/analytics/public` | — | Analytics service — open to all |
| `http://localhost:3000/analytics/internal` | IP filter | Analytics service — allow: `127.0.0.1` |

### Public routes

```bash
curl http://localhost:3000/users
curl http://localhost:3000/products/1
```

### JWT-protected route (`/orders`)

```bash
# 1. Log in to get a token (users: alice/password123, bob/password456)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}' | jq -r '.token')

# 2. Access the protected route
curl http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN"

# 3. Create an order
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"items":[{"productId":2,"qty":1}],"total":24.99}'
```

### API-key-protected route (`/reports`)

```bash
# Valid keys: key-service-alpha-123  ·  key-service-beta-456
curl http://localhost:3000/reports \
  -H "x-api-key: key-service-alpha-123"
```

### Request ID propagation route (`/inventory`)

```bash
# Gateway generates a UUID — echoed in response header and JSON body
curl -si http://localhost:3000/inventory | grep -i x-request-id

# Supply your own correlation ID — forwarded unchanged to the upstream
curl -si http://localhost:3000/inventory \
  -H "X-Request-ID: my-trace-abc-123"

# Confirm the upstream received the same ID — visible in its stdout and the JSON body
curl -s http://localhost:3000/inventory/1 | jq '._requestId'
```

### IP filter routes (`/analytics/*`)

```bash
# Public — no restrictions
curl -s http://localhost:3000/analytics/public | jq

# Internal — allow: 127.0.0.1 — passes from loopback
curl -s http://localhost:3000/analytics/internal | jq

# To observe a block, call the dedicated IP filter example which includes a
# deny route that always returns 403 from loopback:
#   bash examples/ip-filter/run.sh
#   curl -s http://localhost:3000/analytics/blocked | jq
```

### Circuit breaker route (`/payments`)

The payments upstream exposes an admin API on port `4066` (not proxied by the gateway) so you can toggle its health at runtime without restarting anything.

```bash
# 1. Normal request — circuit is CLOSED, upstream responds normally
curl -s http://localhost:3000/payments | jq

# 2. Degrade the upstream
curl -s -X POST http://localhost:4066/mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"failing"}' | jq

# 3. Trigger the threshold (3 failures open the circuit)
curl -s http://localhost:3000/payments | jq   # failure 1
curl -s http://localhost:3000/payments | jq   # failure 2
curl -s http://localhost:3000/payments | jq   # failure 3 → circuit OPEN

# 4. Circuit is now OPEN — gateway short-circuits with 503 + Retry-After
#    (the upstream receives no requests — watch its stdout to confirm)
curl -si http://localhost:3000/payments | head -20

# 5. Restore the upstream
curl -s -X POST http://localhost:4066/mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"healthy"}' | jq

# 6. Wait for the timeout, then the probe closes the circuit
sleep 11 && curl -s http://localhost:3000/payments | jq
```

### Individual example directories

Each sub-directory is also a standalone reference:

| Directory | Features demonstrated |
|---|---|
| `examples/basic/` | Rate limiting — Users + Products services |
| `examples/jwt-auth/` | JWT authentication — Auth + Orders services |
| `examples/api-key-auth/` | API key authentication — Reports service |
| `examples/circuit-breaker/` | Circuit breaker — Payments service with runtime mode toggling |
| `examples/request-id/` | Request ID propagation — Inventory service that echoes the forwarded ID end-to-end |
| `examples/ip-filter/` | IP allowlist / blocklist — Analytics service with three routes (open / allow / deny) |

---

## Architecture

### Request lifecycle

```
Client
  │
  ▼
Express app
  │
  ├─ requestId              inject / forward X-Request-ID header
  ├─ pino-http              structured request/response logging (req.id = X-Request-ID)
  ├─ helmet                 security headers (CSP, HSTS, X-Frame-Options, …)
  ├─ cors                   configurable origin / method / header policy
  ├─ express.json           body parsing
  ├─ compression            gzip response compression
  │
  ├─ GET /health            health check — short-circuits here
  │
  ├─ ipFilter               per-route — IP allow/deny check → 403 on block
  ├─ authMiddleware         per-route — JWT or API key check → 401 on failure
  ├─ express-rate-limit     per-route request throttling → 429 on exceeded
  ├─ circuit breaker guard  per-route — rejects with 503 when circuit is OPEN
  ├─ http-proxy-middleware  proxies request to upstream, forwards body
  │    ├─ proxyRes          5xx responses → recordFailure
  │    └─ error             network errors → recordFailure, responds 502
  │
  └─ error handler          catches unhandled errors → 500 JSON response
```

### Startup sequence

```
index.ts
  │
  ├─ dotenv.config()           load .env before any module reads process.env
  ├─ new App()
  │    └─ new Server()
  │         ├─ appEnv resolved  config modules read from process.env
  │         └─ new Router()
  │
  └─ app.start()
       ├─ router.init()          async: reads routes file, validates, registers middleware
       └─ httpServer.listen()    starts accepting connections only after routes are ready
```

### Route loading

Routes are loaded from two sources at startup and merged into a single array before validation:

```
ROUTES_FILE_PATH (JSON file)  ──┐
                                ├──► merge ──► Zod validation ──► register proxy routes
ROUTES (env var JSON array)   ──┘
```

If either source is missing or contains invalid JSON it is skipped with a warning. If the merged result fails Zod validation, the process exits with a descriptive error.
