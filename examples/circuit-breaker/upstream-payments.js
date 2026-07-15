/**
 * Example upstream: Payments Service
 *
 * Main API  →  http://localhost:4006  (proxied by the gateway at /payments)
 * Admin API →  http://localhost:4066  (direct access only — not exposed through gateway)
 *
 * The service supports two runtime modes that you can toggle via the admin API
 * without restarting the process, making it easy to observe circuit breaker
 * state transitions in real time.
 *
 * Switch modes:
 *   curl -s -X POST http://localhost:4066/mode \
 *     -H 'Content-Type: application/json' \
 *     -d '{"mode":"failing"}'    # returns 500 on every request → opens the circuit
 *
 *   curl -s -X POST http://localhost:4066/mode \
 *     -H 'Content-Type: application/json' \
 *     -d '{"mode":"healthy"}'    # back to normal → probe will close the circuit
 *
 * Check current mode:
 *   curl -s http://localhost:4066/status | jq
 */

const http = require("http");
const { StatusCodes: HttpStatus } = require("http-status-codes");

// ── State ──────────────────────────────────────────────────────────────────

/** @type {"healthy" | "failing"} */
let mode = "healthy";

const payments = [
  { id: 1, userId: 1, amount: 99.99,  currency: "USD", status: "completed", createdAt: "2024-01-15T10:00:00Z" },
  { id: 2, userId: 2, amount: 24.50,  currency: "USD", status: "pending",   createdAt: "2024-01-16T14:30:00Z" },
  { id: 3, userId: 1, amount: 149.00, currency: "USD", status: "failed",    createdAt: "2024-01-17T09:15:00Z" },
];

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
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}

// ── Main API (proxied by gateway) ──────────────────────────────────────────

const mainServer = http.createServer(async (req, res) => {
  if (mode === "failing") {
    console.log(`[payments-service] ⚠  mode=${mode} — returning 500`);
    return json(res, HttpStatus.INTERNAL_SERVER_ERROR, {
      error: "Internal Server Error",
      message: "Payment service is experiencing issues",
    });
  }

  const { method } = req;
  const parts = req.url.split("/").filter(Boolean);

  try {
    // GET / — list all payments
    if (method === "GET" && parts.length === 0) {
      console.log(`[payments-service] GET / — ${payments.length} payments`);
      return json(res, HttpStatus.OK, { payments, total: payments.length });
    }

    // GET /:id — get payment by id
    if (method === "GET" && parts.length === 1) {
      const payment = payments.find((p) => p.id === Number(parts[0]));
      if (!payment) return json(res, HttpStatus.NOT_FOUND, { error: "Payment not found" });
      console.log(`[payments-service] GET /${parts[0]} — found`);
      return json(res, HttpStatus.OK, { payment });
    }

    // POST / — create a payment
    if (method === "POST" && parts.length === 0) {
      const body = await readBody(req);
      if (!body.userId || !body.amount) {
        return json(res, HttpStatus.BAD_REQUEST, { error: "userId and amount are required" });
      }
      const created = {
        id: payments.length + 1,
        status: "pending",
        currency: body.currency ?? "USD",
        createdAt: new Date().toISOString(),
        ...body,
      };
      payments.push(created);
      console.log(`[payments-service] POST / — created payment #${created.id}`);
      return json(res, HttpStatus.CREATED, { payment: created });
    }

    json(res, HttpStatus.NOT_FOUND, { error: "Not found" });
  } catch (err) {
    json(res, HttpStatus.INTERNAL_SERVER_ERROR, { error: err.message });
  }
});

// ── Admin API (direct access, not proxied) ─────────────────────────────────

const adminServer = http.createServer(async (req, res) => {
  // POST /mode — switch service mode
  if (req.method === "POST" && req.url === "/mode") {
    const body = await readBody(req).catch(() => ({}));
    const allowed = ["healthy", "failing"];

    if (!body.mode || !allowed.includes(body.mode)) {
      return json(res, HttpStatus.BAD_REQUEST, {
        error: `mode must be one of: ${allowed.join(", ")}`,
      });
    }

    const prev = mode;
    mode = body.mode;
    console.log(`[payments-service] ✔  mode changed: ${prev} → ${mode}`);
    return json(res, HttpStatus.OK, { mode, previous: prev });
  }

  // GET /status — current mode and data summary
  if (req.method === "GET" && req.url === "/status") {
    return json(res, HttpStatus.OK, { mode, totalPayments: payments.length });
  }

  json(res, HttpStatus.NOT_FOUND, { error: "Not found" });
});

// ── Boot ───────────────────────────────────────────────────────────────────

const MAIN_PORT  = Number(process.env.PAYMENTS_PORT       || 4006);
const ADMIN_PORT = Number(process.env.PAYMENTS_ADMIN_PORT || 4066);

mainServer.listen(MAIN_PORT, () => {
  console.log(`[payments-service] main  listening on http://localhost:${MAIN_PORT}`);
});

adminServer.listen(ADMIN_PORT, () => {
  console.log(`[payments-service] admin listening on http://localhost:${ADMIN_PORT}`);
});
