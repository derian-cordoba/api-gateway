/**
 * Example upstream: Orders Service
 * Runs on http://localhost:4004
 *
 * The gateway proxies /orders/* → this service with pathRewrite stripping /orders,
 * so this service only needs to handle / and /:id.
 *
 * Access is protected at the gateway level via JWT auth — this service
 * trusts that any request it receives has already been authenticated.
 */

const http = require("http");
const { StatusCodes: HttpStatus } = require("http-status-codes");

const orders = [
  { id: 1, userId: 1, status: "delivered", total: 49.97, items: [{ productId: 1, qty: 2 }, { productId: 3, qty: 1 }] },
  { id: 2, userId: 2, status: "pending",   total: 24.99, items: [{ productId: 2, qty: 1 }] },
  { id: 3, userId: 1, status: "shipped",   total: 14.98, items: [{ productId: 3, qty: 3 }] },
];

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

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const parts = req.url.split("/").filter(Boolean);

  try {
    // GET / — list all orders
    if (method === "GET" && parts.length === 0) {
      return json(res, HttpStatus.OK, { orders, total: orders.length });
    }

    // GET /:id — get order by id
    if (method === "GET" && parts.length === 1) {
      const order = orders.find((o) => o.id === Number(parts[0]));
      if (!order) return json(res, HttpStatus.NOT_FOUND, { error: "Order not found" });
      return json(res, HttpStatus.OK, { order });
    }

    // POST / — create an order
    if (method === "POST" && parts.length === 0) {
      const body = await readBody(req);
      if (!body.userId || !Array.isArray(body.items) || body.items.length === 0) {
        return json(res, HttpStatus.BAD_REQUEST, { error: "userId and items are required" });
      }
      const created = { id: orders.length + 1, status: "pending", total: body.total ?? 0, ...body };
      orders.push(created);
      return json(res, HttpStatus.CREATED, { order: created });
    }

    // PATCH /:id/status — update order status
    if (method === "PATCH" && parts.length === 2 && parts[1] === "status") {
      const order = orders.find((o) => o.id === Number(parts[0]));
      if (!order) return json(res, HttpStatus.NOT_FOUND, { error: "Order not found" });
      const { status } = await readBody(req);
      if (!status) return json(res, HttpStatus.BAD_REQUEST, { error: "status is required" });
      order.status = status;
      return json(res, HttpStatus.OK, { order });
    }

    json(res, HttpStatus.NOT_FOUND, { error: "Not found" });
  } catch (err) {
    json(res, HttpStatus.BAD_REQUEST, { error: err.message });
  }
});

const PORT = Number(process.env.ORDERS_PORT || 4004);
server.listen(PORT, () => {
  console.log(`[orders-service]   listening on http://localhost:${PORT}`);
});
