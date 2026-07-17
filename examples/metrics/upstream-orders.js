/**
 * Example upstream: Orders Service
 *
 * Main API  →  http://localhost:4030  (proxied by the gateway at /orders)
 * Admin API →  http://localhost:4031  (direct access only — control error injection)
 *
 * The service supports two runtime modes you can toggle via the admin API:
 *   healthy  — responds 200 on every request
 *   failing  — returns 500 to drive gateway_upstream_errors_total up
 *
 * Switch mode:
 *   curl -s -X POST http://localhost:4031/mode \
 *     -H 'Content-Type: application/json' \
 *     -d '{"mode":"failing"}'
 */

const http = require("http");

// ── State ──────────────────────────────────────────────────────────────────

/** @type {"healthy" | "failing"} */
let mode = "healthy";

const orders = [
  { id: 1, userId: 1, total: 199.99, status: "shipped",   createdAt: "2024-01-10T08:00:00Z" },
  { id: 2, userId: 2, total: 49.50,  status: "pending",   createdAt: "2024-01-11T12:30:00Z" },
  { id: 3, userId: 1, total: 320.00, status: "delivered", createdAt: "2024-01-12T15:45:00Z" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
  });
}

// ── Main API ───────────────────────────────────────────────────────────────

const mainServer = http.createServer(async (req, res) => {
  if (mode === "failing") {
    console.log(`[orders] mode=failing → 500`);
    return json(res, 500, { error: "Internal Server Error", message: "Orders service is unavailable" });
  }

  const { method } = req;
  const parts = req.url.split("?")[0].split("/").filter(Boolean);

  try {
    if (method === "GET" && parts.length === 0) {
      console.log(`[orders] GET / → 200 (${orders.length} orders)`);
      return json(res, 200, { orders, total: orders.length });
    }

    if (method === "GET" && parts.length === 1) {
      const order = orders.find((o) => o.id === Number(parts[0]));
      if (!order) return json(res, 404, { error: "Order not found" });
      console.log(`[orders] GET /${parts[0]} → 200`);
      return json(res, 200, { order });
    }

    if (method === "POST" && parts.length === 0) {
      const body = await readBody(req);
      if (!body.userId || !body.total) {
        return json(res, 400, { error: "userId and total are required" });
      }
      const created = { id: orders.length + 1, status: "pending", createdAt: new Date().toISOString(), ...body };
      orders.push(created);
      console.log(`[orders] POST / — created #${created.id}`);
      return json(res, 201, { order: created });
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

// ── Admin API ──────────────────────────────────────────────────────────────

const adminServer = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/mode") {
    const body = await readBody(req).catch(() => ({}));
    const allowed = ["healthy", "failing"];
    if (!body.mode || !allowed.includes(body.mode)) {
      return json(res, 400, { error: `mode must be one of: ${allowed.join(", ")}` });
    }
    const prev = mode;
    mode = body.mode;
    console.log(`[orders] mode changed: ${prev} → ${mode}`);
    return json(res, 200, { mode, previous: prev });
  }

  if (req.method === "GET" && req.url === "/status") {
    return json(res, 200, { mode, totalOrders: orders.length });
  }

  json(res, 404, { error: "Not found" });
});

// ── Boot ───────────────────────────────────────────────────────────────────

const MAIN_PORT  = Number(process.env.ORDERS_PORT       || 4030);
const ADMIN_PORT = Number(process.env.ORDERS_ADMIN_PORT || 4031);

mainServer.listen(MAIN_PORT, () => {
  console.log(`[orders] main  listening on http://localhost:${MAIN_PORT}`);
});

adminServer.listen(ADMIN_PORT, () => {
  console.log(`[orders] admin listening on http://localhost:${ADMIN_PORT}`);
});
