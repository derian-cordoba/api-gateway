# API Gateway

A generic, configuration-driven HTTP API gateway. Routes incoming requests to upstream services via a JSON config file or environment variable, with per-route rate limiting, request validation, structured logging, and full security headers out of the box.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Route Configuration](#route-configuration)
- [Running the Gateway](#running-the-gateway)
- [Health Check](#health-check)
- [Project Structure](#project-structure)
- [Example Project](#example-project)
- [Architecture](#architecture)

---

## Features

- **Configuration-driven routing** — define proxy routes in a JSON file, an environment variable, or both; changes take effect on restart with zero code changes
- **Per-route rate limiting** — each route can declare its own `max` requests / `windowMs` window, enforced by `express-rate-limit`
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

---

### Route Configuration

Routes are defined as a JSON array. Each entry is a **Gateway** object:

```ts
{
  baseURL:    string     // required — path prefix to match, must start with "/"
  proxy:      Proxy      // required — upstream proxy settings
  rateLimit?: RateLimit  // optional — per-route rate limiting
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
      "pathRewrite": { "^/orders": "" },
      "headers": {
        "X-Internal-Source": "api-gateway"
      },
      "timeout": 5000
    }
  }
]
```

Config is validated with [Zod](https://zod.dev) at startup. If any route is invalid the process exits immediately with a detailed per-field error message.

Routes are loaded from two sources and **merged**:

1. `ROUTES_FILE_PATH` — JSON file on disk (missing file is a warning, not an error)
2. `ROUTES` — JSON array in an environment variable

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
│   └── routes/config.ts      # ROUTES_FILE_PATH
│
├── routes/
│   ├── Router.ts             # Middleware pipeline (logging → security → CORS → body → proxy → errors)
│   ├── ProxyManager.ts       # Reads, validates, and registers proxy routes
│   ├── RouteValidator.ts     # Zod schemas for Gateway / Proxy / RateLimit types
│   └── HealthRouter.ts       # GET /health handler
│
└── types/
    ├── gateway.d.ts          # Gateway type
    ├── proxy.d.ts            # Proxy type
    └── rate-limit.d.ts       # RateLimit type
```

---

## Example Project

`examples/basic/` contains a self-contained demo with two mock upstream services and a pre-built gateway config.

### What's included

| File | Description |
|---|---|
| `routes.json` | Gateway config with two routes (`/users`, `/products`) each with rate limiting and path rewriting |
| `.env` | Gateway environment for the example |
| `upstream-users.js` | Mock Users service on port `4001` |
| `upstream-products.js` | Mock Products service on port `4002` |
| `run.sh` | Starts all three processes and stops them together on Ctrl+C |

### Running the example

```bash
pnpm example
```

This copies `examples/basic/.env` to the project root and starts all three services. Once running:

| Endpoint | Description |
|---|---|
| `http://localhost:3000/health` | Gateway health check |
| `http://localhost:3000/users` | Proxied to Users service |
| `http://localhost:3000/products` | Proxied to Products service |

### Users service endpoints (`/users`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | List all users |
| `GET` | `/users/:id` | Get a user by ID |
| `POST` | `/users` | Create a user (body: `{ name, email }`) |
| `DELETE` | `/users/:id` | Delete a user by ID |

### Products service endpoints (`/products`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/products` | List all products |
| `GET` | `/products/:id` | Get a product by ID |
| `POST` | `/products` | Create a product (body: `{ name, price }`) |
| `PATCH` | `/products/:id/stock` | Adjust stock (body: `{ quantity: number }`) |

### Example requests

```bash
# List users
curl http://localhost:3000/users

# Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# Get a product
curl http://localhost:3000/products/1

# Update product stock
curl -X PATCH http://localhost:3000/products/1/stock \
  -H "Content-Type: application/json" \
  -d '{"quantity": 25}'
```

---

## Architecture

### Request lifecycle

```
Client
  │
  ▼
Express app
  │
  ├─ pino-http          structured request/response logging
  ├─ helmet             security headers (CSP, HSTS, X-Frame-Options, …)
  ├─ cors               configurable origin / method / header policy
  ├─ express.json       body parsing
  ├─ compression        gzip response compression
  │
  ├─ GET /health        health check — short-circuits here
  │
  ├─ express-rate-limit per-route request throttling (applied per baseURL)
  ├─ http-proxy-middleware  proxies request to upstream, forwards body
  │
  └─ error handler      catches unhandled errors → 500 JSON response
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
