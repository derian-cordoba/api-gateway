/**
 * Example upstream: Reports Service
 * Runs on http://localhost:4005
 *
 * An internal analytics service intended for machine-to-machine access.
 * The gateway protects it with API key auth — any caller must present a
 * valid key in the x-api-key header before the gateway forwards the request.
 *
 * Routes (after pathRewrite strips /reports):
 *   GET /          — summary dashboard
 *   GET /sales     — sales breakdown by month
 *   GET /users     — user acquisition stats
 */

const http = require("http");
const { StatusCodes: HttpStatus } = require("http-status-codes");

const summary = {
  revenue: { total: 128_450.75, currency: "USD" },
  orders: { total: 3_241, pending: 124, delivered: 2_980 },
  users: { total: 8_732, newThisMonth: 312 },
  generatedAt: new Date().toISOString(),
};

const sales = [
  { month: "2025-01", revenue: 18_200.00, orders: 420 },
  { month: "2025-02", revenue: 21_340.50, orders: 510 },
  { month: "2025-03", revenue: 19_870.25, orders: 476 },
  { month: "2025-04", revenue: 24_600.00, orders: 588 },
  { month: "2025-05", revenue: 22_190.00, orders: 531 },
  { month: "2025-06", revenue: 22_250.00, orders: 716 },
];

const users = [
  { month: "2025-01", newUsers: 210, churned: 18, retention: "91%" },
  { month: "2025-02", newUsers: 264, churned: 22, retention: "92%" },
  { month: "2025-03", newUsers: 198, churned: 15, retention: "93%" },
  { month: "2025-04", newUsers: 312, churned: 28, retention: "91%" },
  { month: "2025-05", newUsers: 289, churned: 20, retention: "93%" },
  { month: "2025-06", newUsers: 312, churned: 17, retention: "95%" },
];

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer((req, res) => {
  const { method, url } = req;

  if (method !== "GET") {
    return json(res, HttpStatus.METHOD_NOT_ALLOWED, { error: "Method not allowed" });
  }

  if (url === "/" || url === "") return json(res, HttpStatus.OK, { summary });
  if (url === "/sales")         return json(res, HttpStatus.OK, { sales });
  if (url === "/users")         return json(res, HttpStatus.OK, { users });

  json(res, HttpStatus.NOT_FOUND, { error: "Not found" });
});

const PORT = Number(process.env.REPORTS_PORT || 4005);
server.listen(PORT, () => {
  console.log(`[reports-service]  listening on http://localhost:${PORT}`);
});
