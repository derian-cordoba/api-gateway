/**
 * Example upstream: Inventory Service
 *
 * Main API  →  http://localhost:4010  (proxied by the gateway at /inventory)
 * Admin API →  http://localhost:4011  (direct access only — not exposed through gateway)
 *
 * Supports three runtime modes you can toggle via the admin API:
 *
 *   healthy   — responds 200 on every request
 *   flaky     — fails the first N requests then recovers (simulates a transient fault)
 *   failing   — always returns 500 (simulates a persistent outage)
 *
 * Switch modes:
 *   curl -s -X POST http://localhost:4011/mode \
 *     -H 'Content-Type: application/json' \
 *     -d '{"mode":"flaky","failCount":2}'
 *
 *   curl -s -X POST http://localhost:4011/mode \
 *     -H 'Content-Type: application/json' \
 *     -d '{"mode":"healthy"}'
 *
 * Check current mode / call counter:
 *   curl -s http://localhost:4011/status | jq
 */

const http = require("http");

// ── State ──────────────────────────────────────────────────────────────────

/** @type {"healthy" | "flaky" | "failing"} */
let mode = "healthy";
let failCount = 2;   // in "flaky" mode: how many calls to fail before recovering
let callsSinceReset = 0;

const items = [
  { id: 1, sku: "WIDGET-A", name: "Widget A", stock: 120, warehouse: "EU-WEST" },
  { id: 2, sku: "WIDGET-B", name: "Widget B", stock: 45,  warehouse: "US-EAST" },
  { id: 3, sku: "GADGET-X", name: "Gadget X", stock: 0,   warehouse: "EU-WEST" },
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
  callsSinceReset++;
  const call = callsSinceReset;

  if (mode === "failing") {
    console.log(`[inventory] call #${call} — mode=failing → 500`);
    return json(res, 500, { error: "Internal Server Error", message: "Inventory service is down" });
  }

  if (mode === "flaky" && call <= failCount) {
    console.log(`[inventory] call #${call}/${failCount} — mode=flaky → 500 (will recover on call ${failCount + 1})`);
    return json(res, 500, { error: "Internal Server Error", message: "Transient fault — please retry" });
  }

  const { method } = req;
  const parts = req.url.split("?")[0].split("/").filter(Boolean);

  try {
    if (method === "GET" && parts.length === 0) {
      console.log(`[inventory] call #${call} — GET / → 200 (${items.length} items)`);
      return json(res, 200, { items, total: items.length });
    }

    if (method === "GET" && parts.length === 1) {
      const item = items.find((i) => i.id === Number(parts[0]));
      if (!item) return json(res, 404, { error: "Item not found" });
      console.log(`[inventory] call #${call} — GET /${parts[0]} → 200`);
      return json(res, 200, { item });
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
    const allowed = ["healthy", "flaky", "failing"];

    if (!body.mode || !allowed.includes(body.mode)) {
      return json(res, 400, { error: `mode must be one of: ${allowed.join(", ")}` });
    }

    const prev = mode;
    mode = body.mode;
    if (body.failCount !== undefined) failCount = body.failCount;
    callsSinceReset = 0;
    console.log(`[inventory] mode changed: ${prev} → ${mode}${mode === "flaky" ? ` (failCount=${failCount})` : ""} — call counter reset`);
    return json(res, 200, { mode, failCount: mode === "flaky" ? failCount : undefined, previous: prev });
  }

  if (req.method === "GET" && req.url === "/status") {
    return json(res, 200, { mode, failCount: mode === "flaky" ? failCount : undefined, callsSinceReset });
  }

  json(res, 404, { error: "Not found" });
});

// ── Boot ───────────────────────────────────────────────────────────────────

const MAIN_PORT  = Number(process.env.INVENTORY_PORT       || 4010);
const ADMIN_PORT = Number(process.env.INVENTORY_ADMIN_PORT || 4011);

mainServer.listen(MAIN_PORT, () => {
  console.log(`[inventory] main  listening on http://localhost:${MAIN_PORT}`);
});

adminServer.listen(ADMIN_PORT, () => {
  console.log(`[inventory] admin listening on http://localhost:${ADMIN_PORT}`);
});
