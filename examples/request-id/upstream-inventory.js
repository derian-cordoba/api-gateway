const { readBody, json: sendJson, pathParts, createServer } = require("../shared/http");
/**
 * Example upstream: Inventory Service
 *
 * Runs on http://localhost:4007  (proxied by the gateway at /inventory)
 *
 * This service intentionally echoes the X-Request-ID header it receives so
 * you can verify that the gateway forwards the same correlation ID to the
 * upstream, and that the upstream can use it for its own log lines.
 *
 * Every log line printed by this service includes the request ID, making it
 * easy to trace a single request end-to-end across the gateway and the
 * upstream without any shared infrastructure.
 */

const { StatusCodes: HttpStatus } = require("http-status-codes");

const REQUEST_ID_HEADER = "x-request-id";

const items = [
  { id: 1, sku: "WIDGET-001", name: "Standard Widget",  stock: 142, warehouse: "EU-WEST" },
  { id: 2, sku: "WIDGET-002", name: "Premium Widget",   stock: 58,  warehouse: "EU-WEST" },
  { id: 3, sku: "GADGET-001", name: "Basic Gadget",     stock: 23,  warehouse: "US-EAST" },
  { id: 4, sku: "GADGET-002", name: "Advanced Gadget",  stock: 0,   warehouse: "US-EAST" },
];

function json(res, status, data, requestId) {
  sendJson(res, status, data, requestId ? { [REQUEST_ID_HEADER]: requestId } : {});
}

const server = createServer(async (req, res) => {
  const requestId = req.headers[REQUEST_ID_HEADER] ?? "(none)";
  const { method } = req;
  const parts = pathParts(req);

  // Log every incoming request with the correlation ID
  console.log(`[inventory-service] ${method} ${req.url}  request-id=${requestId}`);

  try {
    // GET / — list all items
    if (method === "GET" && parts.length === 0) {
      return json(res, HttpStatus.OK, {
        items,
        total: items.length,
        _requestId: requestId,   // echo it back so the demo output makes it obvious
      }, requestId);
    }

    // GET /:id — get item by id
    if (method === "GET" && parts.length === 1) {
      const item = items.find((i) => i.id === Number(parts[0]));
      if (!item) {
        return json(res, HttpStatus.NOT_FOUND, {
          error: "Item not found",
          _requestId: requestId,
        }, requestId);
      }
      return json(res, HttpStatus.OK, { item, _requestId: requestId }, requestId);
    }

    // POST / — create an item
    if (method === "POST" && parts.length === 0) {
      const body = await readBody(req);
      if (!body.sku || !body.name) {
        return json(res, HttpStatus.BAD_REQUEST, {
          error: "sku and name are required",
          _requestId: requestId,
        }, requestId);
      }
      const created = {
        id: items.length + 1,
        stock: body.stock ?? 0,
        warehouse: body.warehouse ?? "EU-WEST",
        ...body,
      };
      items.push(created);
      console.log(`[inventory-service] created item #${created.id}  request-id=${requestId}`);
      return json(res, HttpStatus.CREATED, { item: created, _requestId: requestId }, requestId);
    }

    // PATCH /:id/stock — adjust stock level
    if (method === "PATCH" && parts.length === 2 && parts[1] === "stock") {
      const item = items.find((i) => i.id === Number(parts[0]));
      if (!item) {
        return json(res, HttpStatus.NOT_FOUND, {
          error: "Item not found",
          _requestId: requestId,
        }, requestId);
      }
      const body = await readBody(req);
      if (typeof body.delta !== "number") {
        return json(res, HttpStatus.BAD_REQUEST, {
          error: "delta (number) is required",
          _requestId: requestId,
        }, requestId);
      }
      const prev = item.stock;
      item.stock = Math.max(0, item.stock + body.delta);
      console.log(`[inventory-service] stock adjusted #${item.id}: ${prev} → ${item.stock}  request-id=${requestId}`);
      return json(res, HttpStatus.OK, { item, _requestId: requestId }, requestId);
    }

    json(res, HttpStatus.NOT_FOUND, { error: "Not found", _requestId: requestId }, requestId);
  } catch (err) {
    json(res, HttpStatus.INTERNAL_SERVER_ERROR, {
      error: err.message,
      _requestId: requestId,
    }, requestId);
  }
});

const PORT = Number(process.env.INVENTORY_PORT || 4007);
server.listen(PORT, () => {
  console.log(`[inventory-service] listening on http://localhost:${PORT}`);
});
