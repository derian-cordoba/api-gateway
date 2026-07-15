/**
 * Example upstream: Analytics Service
 *
 * Runs on http://localhost:4008  (proxied by the gateway)
 *
 * The gateway exposes this service on two routes with different IP policies:
 *
 *   /analytics/public   — open to everyone (no ipFilter)
 *   /analytics/internal — allow list: 127.0.0.1 only
 *   /analytics/blocked  — deny  list: 127.0.0.1  (always blocks loopback)
 *
 * This makes it straightforward to see both sides of the IP filter from a
 * single terminal: the allow route passes, the deny route returns 403 — the
 * upstream never sees the blocked requests at all.
 */

const http = require("http");
const { StatusCodes: HttpStatus } = require("http-status-codes");

// ── Seed data ──────────────────────────────────────────────────────────────

const events = [
  { id: 1, event: "page_view",  path: "/home",     userId: 1, ts: "2024-01-15T10:00:00Z" },
  { id: 2, event: "page_view",  path: "/products",  userId: 2, ts: "2024-01-15T10:01:00Z" },
  { id: 3, event: "add_to_cart",path: "/cart",      userId: 1, ts: "2024-01-15T10:02:00Z" },
  { id: 4, event: "purchase",   path: "/checkout",  userId: 1, ts: "2024-01-15T10:05:00Z" },
  { id: 5, event: "page_view",  path: "/about",     userId: 3, ts: "2024-01-15T10:08:00Z" },
];

const summary = {
  totalEvents: events.length,
  uniqueUsers: new Set(events.map((e) => e.userId)).size,
  eventTypes: events.reduce((acc, e) => {
    acc[e.event] = (acc[e.event] ?? 0) + 1;
    return acc;
  }, {}),
};

// ── Helpers ────────────────────────────────────────────────────────────────

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON body")); }
    });
  });
}

// ── Server ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const { method } = req;
  // The gateway strips the route prefix via pathRewrite; all paths seen here
  // are relative to the upstream root.
  const parts = req.url.split("/").filter(Boolean);

  console.log(`[analytics-service] ${method} ${req.url}`);

  try {
    // GET / — summary (used by all three gateway routes)
    if (method === "GET" && parts.length === 0) {
      return json(res, HttpStatus.OK, { summary });
    }

    // GET /events — full event list
    if (method === "GET" && parts[0] === "events") {
      return json(res, HttpStatus.OK, { events, total: events.length });
    }

    // POST /events — record a new event
    if (method === "POST" && parts[0] === "events") {
      const body = await readBody(req);
      if (!body.event || !body.path) {
        return json(res, HttpStatus.BAD_REQUEST, { error: "event and path are required" });
      }
      const created = {
        id: events.length + 1,
        userId: body.userId ?? null,
        ts: new Date().toISOString(),
        ...body,
      };
      events.push(created);
      summary.totalEvents++;
      summary.uniqueUsers = new Set(events.map((e) => e.userId)).size;
      summary.eventTypes[created.event] = (summary.eventTypes[created.event] ?? 0) + 1;
      console.log(`[analytics-service] recorded event "${created.event}" #${created.id}`);
      return json(res, HttpStatus.CREATED, { event: created });
    }

    json(res, HttpStatus.NOT_FOUND, { error: "Not found" });
  } catch (err) {
    json(res, HttpStatus.INTERNAL_SERVER_ERROR, { error: err.message });
  }
});

const PORT = Number(process.env.ANALYTICS_PORT || 4008);
server.listen(PORT, () => {
  console.log(`[analytics-service] listening on http://localhost:${PORT}`);
});
