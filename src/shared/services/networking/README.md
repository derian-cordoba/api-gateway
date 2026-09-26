# Shared HTTP manager

Dashboard and Observatory use this module for browser API requests. Observatory's
server-side management client uses the same manager with a server-only base URL and
bearer token. Domain services retain endpoint names, authentication, validation, and
user-facing error messages. The manager contains no environment or token storage logic.

## Live requests

```ts
import { createHttpManager, HttpMethod } from "@shared/services/networking";

const http = createHttpManager({
  baseURL: "https://example.com/management/",
  timeoutMs: 5_000,
  headers: () => ({ Authorization: `Bearer ${readCurrentToken()}` }),
});

const events = await http.get<GatewayEvents>("/v1/events", {
  query: { limit: 25, category: ["routing", "health"] },
  signal: controller.signal,
});

await http.put("/v1/config", { json: { routes, expectedRevision } });
```

Omit `baseURL` for same-origin browser requests such as `/api/gateway/overview`.
On the server, supply an absolute base URL. Leading slashes in endpoint paths retain
the configured base path: `/v1/events` above resolves under `/management/`.
Absolute endpoint URLs are supported only when no base URL is configured. Base URLs
cannot contain queries or fragments; URL credentials and authority overrides are rejected.

`get`, `post`, `put`, `patch`, and `delete` delegate to `request`. Use `request` for
`HttpMethod.HEAD` or `HttpMethod.OPTIONS`. The shared `HttpMethod` enum is also used
for mock routes and the Dashboard method picker. Native request settings such as `credentials`, `redirect`, and
`mode` can be supplied per request. Caching defaults to `no-store`.

Headers accept objects, tuples, and `Headers`; request headers override defaults
case-insensitively. Header factories run for each request so rotated tokens are read
at request time. JSON is serialized once and gets a default JSON content type.
Use `body` for strings, `FormData`, and binary payloads; multipart boundaries are left
to fetch. Combining `body` and `json`, or sending either with GET/HEAD, is rejected.

Query values support strings, numbers, booleans, and repeated array values. Null and
undefined are omitted; supplied values replace the same key in the endpoint query.

## Response types and validation

JSON is the default. `responseType` also supports `text`, `blob`, and `arrayBuffer`.
HEAD, 204, 205, and empty JSON responses resolve to `undefined`; use a matching result
type for endpoints without a body. Generic types describe a contract, but do not
validate data. Supply a synchronous `decode` callback for runtime validation:

```ts
const result = await http.get("/v1/overview", {
  decode: (data) => overviewSchema.parse(data),
});
const download = await http.get<Blob>("/v1/export", { responseType: "blob" });
```

## Errors and cancellation

`HttpError` preserves its original `cause` through `withErrorContext`:

| kind            | Meaning                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| `configuration` | Invalid URL, conflicting body options, invalid timeout, or missing mock route |
| `network`       | Transport or connection failure                                               |
| `timeout`       | Manager deadline expired                                                      |
| `aborted`       | Caller's signal was cancelled                                                 |
| `http`          | Non-success HTTP status; includes `status` and parsed `payload`               |
| `decode`        | Successful response could not be parsed or validated; includes `status`       |

JSON error bodies can supply `message` or `error`. HTML/text error bodies are retained
as payloads but use a generic status message. Credentials, headers, and request bodies
are not copied into error messages. Domain clients wrap these errors with their existing
application-specific errors, preserving the cause chain.

The default deadline is 15 seconds; `timeoutMs: 0` disables it. Observatory management
requests use five seconds. The deadline includes response body consumption. Timers and
abort listeners are cleaned up after settlement. Cancellation rejects even if an
injected transport ignores the signal; custom handlers should also observe `init.signal`
to stop their own work. Requests execute once; mutation retries require endpoint-specific
idempotency guarantees and belong in a deliberate caller policy.

## Mock mode

Select the transport at application composition or in tests. No global flag changes
existing instances, and production remains live by default. A mock manager uses exactly
the same request preparation, deadlines, parsing, validation, and error mapping.

```ts
import { createHttpManager, HttpMethod } from "@shared/services/networking";
import { ObservatoryApiService } from "@/modules/overview/services/observatory-api";

const http = createHttpManager({
  mode: "mock",
  routes: [
    {
      method: HttpMethod.GET,
      path: "/api/gateway/events",
      respond: ({ url }) =>
        Response.json({
          events: fixtureEvents.slice(0, Number(url.searchParams.get("limit"))),
        }),
    },
  ],
});
const api = new ObservatoryApiService(http);
await api.getEvents(25);
```

Pass the same manager to `new DashboardApiClient(http)` or, on the server,
`new GatewayManagementClient(config, http)`. Keep fixtures local to their domain.
Mock paths match exact URL pathnames and methods; query values, headers, body, and
signal are available to each handler. Handlers must return a fresh `Response` per call
because response bodies are consumable once. Return error responses to exercise HTTP
failures, throw to simulate transport failures, or await a delay to simulate latency.
Unmatched routes fail explicitly and never fall through to the network.

For other transports, implement `HttpTransport.send(url, init): Promise<Response>`
and inject it into `new HttpManager({ transport })`. `FetchHttpClient` also accepts
an optional fetch implementation. No Axios or additional runtime dependency is required.

## Verification

From the repository root:

```sh
pnpm exec vitest run tests/unit/http-manager.test.ts
pnpm test:dashboard
pnpm test:observatory
```
