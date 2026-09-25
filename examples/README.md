# Gateway examples

Install repository dependencies, then run from any directory:

```bash
bash examples/run.sh --list
bash examples/run.sh basic
bash examples/run.sh webhook
bash examples/run.sh            # all examples together
bash examples/basic/run.sh      # equivalent standalone entry point
```

The launcher compiles the gateway, checks ports, starts upstreams, waits for readiness, then starts the gateway. Ctrl+C, termination, startup failures, and unexpected child exits clean up the processes it started. Busy ports produce an error. The launcher does not overwrite `.env`. Gateway configuration is passed through the child environment; use `GATEWAY_PORT=3100 bash examples/run.sh basic` to change its port. Upstream ports are fixed by each route configuration and `shared/services.json`.

`shared/http.js` contains JSON responses, bounded body parsing, query-safe path parsing, delays, and async request error handling. `shared/run.sh` is the common bash entry point; `shared/runner.js` owns process lifecycle and `shared/services.json` declares services, ports, and combined-mode overrides. Add new scenarios to that manifest, provide `routes.json`, and add their routes to the combined `examples/routes.json`.

Existing walkthroughs are available with `bash examples/<name>/walkthrough.sh`. They print requests for the standalone example on port 3000; combined routes can have different prefixes, shown at startup. Credentials and secrets in these examples are for local demonstrations.

| Example | Demonstrates |
| --- | --- |
| basic | Users/products CRUD and rate limiting |
| jwt-auth | Login and JWT-protected orders |
| api-key-auth | API key authentication |
| basic-auth | Basic credentials and authentication failure limiting |
| oauth2 | Opaque token issuance and introspection |
| circuit-breaker | Runtime failures and circuit recovery |
| retry | Backoff with healthy/flaky/failing upstream modes |
| timeout | A slow upstream returning 504 through the gateway |
| cache | Cache hits versus upstream request counts |
| metrics | Prometheus counters and failure injection |
| request-id | Correlation ID propagation |
| ip-filter | Public, allowed, and denied routes |
| load-balancer | Round-robin, weighted, and least-connections |
| websocket | WebSocket chat and HTTP upgrade forwarding |
| header-transform | Request and response header transformations |
| route-cors | Global and per-route CORS policies |
| validation | Content type, required fields, and body size |
| webhook | GitHub, Stripe, and custom HMAC verification |
| upstream-signing | Gateway HMAC verified by an upstream |
| traffic-mirroring | Primary traffic copied to a shadow upstream |

## New scenarios

Each project owns its upstream JavaScript entry point. Basic Auth, validation, webhook ingestion, and the mirror's primary service reuse `shared/echo.js` to show accepted requests. Authentication, validation, and webhook verification happen in the gateway, as configured in each project's `routes.json`.

| Project | JavaScript services | Default ports |
| --- | --- | --- |
| basic-auth | `upstream-protected.js` | `BASIC_AUTH_PORT=4070` |
| validation | `upstream-contacts.js` | `CONTACTS_PORT=4071` |
| webhook | `upstream-events.js`; `send.js` signs client requests | `EVENTS_PORT=4072` |
| timeout | `upstream-slow.js` | `SLOW_PORT=4073` |
| upstream-signing | `upstream-signed.js` verifies the gateway HMAC | `SIGNED_PORT=4074` |
| traffic-mirroring | `upstream-primary.js`, `upstream-shadow.js` | `PRIMARY_PORT=4075`, `SHADOW_PORT=4076` |

You can start an upstream directly, for example `node examples/timeout/upstream-slow.js`. Use the project's `run.sh` to start both its upstreams and the gateway. When running an upstream manually on a different port, update its route target too.

Run the corresponding example first, or run all examples together. These requests use the same paths in both modes.

```bash
# Basic Auth: 401 without credentials; 200 with credentials.
curl -i http://localhost:3000/basic-auth
curl -i -u alice:password123 http://localhost:3000/basic-auth
# Five failed attempts trigger the authentication limiter; allow a minute to reset.

# Validation: 200 for both fields; 422 when fields are missing.
curl -i http://localhost:3000/validated -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com"}'
curl -i http://localhost:3000/validated -H 'Content-Type: application/json' -d '{}'
# text/plain is rejected with 415; JSON bodies above 1024 bytes with 413.

# Webhooks: signed requests return 200; unsigned/invalid signatures return 401.
node examples/webhook/send.js github
node examples/webhook/send.js stripe
node examples/webhook/send.js custom
curl -i http://localhost:3000/webhooks/github -H 'Content-Type: application/json' -d '{}'

# Timeout: upstream sleeps 500 ms; the gateway deadline is 100 ms.
curl -i http://localhost:3000/slow

# Signing: 200 through the gateway; 401 when sent directly without a signature.
curl -i http://localhost:3000/signed -H 'Content-Type: application/json' -d '{"event":"created"}'
curl -i http://localhost:4074 -H 'Content-Type: application/json' -d '{"event":"created"}'

# Mirroring: primary responds immediately; the shadow request count increases asynchronously.
curl -i http://localhost:3000/mirrored -H 'Content-Type: application/json' -d '{"event":"created"}'
curl -s http://localhost:4076/stats
```

Signing and mirroring currently use the gateway's retry backend, so those routes set `retry.attempts: 1` to select it. This allows one retry after the initial request; it does not disable retries. HTTP-status and network-error retries both honor `retryMethods`, which defaults to GET, HEAD, and OPTIONS. Stripe verification enforces a five-minute timestamp tolerance by default, accepts any matching `v1` signature, and supports optional in-process replay protection with `replayProtection: true`.

To run the automated HTTP smoke checks after compiling the gateway:

```bash
node node_modules/typescript/bin/tsc -p tsconfig.prod.json
node examples/shared/smoke.js
```

The smoke runner starts and stops its own combined stack on gateway port 3099. Stop other examples first because upstream ports are shared.
