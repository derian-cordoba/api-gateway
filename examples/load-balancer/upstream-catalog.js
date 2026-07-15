/**
 * Example upstream: Catalog Service (three instances)
 *
 * Each instance listens on a different port and includes its own port in every
 * response body. This makes it easy to observe which instance the gateway
 * routed each request to, and to verify that requests are being distributed
 * according to the configured load-balancing strategy.
 *
 * Ports:
 *   Instance A  →  4010  (weight 1 in the weighted example)
 *   Instance B  →  4011  (weight 2 in the weighted example)
 *   Instance C  →  4012  (weight 1 in the weighted example)
 *
 * Usage:
 *   CATALOG_PORT=4010 CATALOG_INSTANCE=A node upstream-catalog.js
 *   CATALOG_PORT=4011 CATALOG_INSTANCE=B node upstream-catalog.js
 *   CATALOG_PORT=4012 CATALOG_INSTANCE=C node upstream-catalog.js
 */

const http = require("http");
const { StatusCodes: HttpStatus } = require("http-status-codes");

const PORT     = Number(process.env.CATALOG_PORT     || 4010);
const INSTANCE = process.env.CATALOG_INSTANCE        || "A";

// ── Seed data ──────────────────────────────────────────────────────────────

const products = [
  { id: 1, name: "Widget Pro",    category: "hardware", price: 29.99 },
  { id: 2, name: "Gadget Deluxe", category: "hardware", price: 49.99 },
  { id: 3, name: "Service Basic", category: "software", price: 9.99  },
  { id: 4, name: "Service Plus",  category: "software", price: 19.99 },
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
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON body")); }
    });
  });
}

// ── Server ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const parts = req.url.split("/").filter(Boolean);

  console.log(`[catalog-${INSTANCE}:${PORT}] ${method} ${req.url}`);

  // Metadata added to every response so the caller can see which instance responded
  const meta = { instance: INSTANCE, port: PORT };

  try {
    if (method === "GET" && parts.length === 0) {
      return json(res, HttpStatus.OK, { products, total: products.length, ...meta });
    }

    if (method === "GET" && parts.length === 1) {
      const product = products.find((p) => p.id === Number(parts[0]));
      if (!product) return json(res, HttpStatus.NOT_FOUND, { error: "Not found", ...meta });
      return json(res, HttpStatus.OK, { product, ...meta });
    }

    if (method === "POST" && parts.length === 0) {
      const body = await readBody(req);
      if (!body.name || !body.price) {
        return json(res, HttpStatus.BAD_REQUEST, { error: "name and price are required", ...meta });
      }
      const created = { id: products.length + 1, category: "general", ...body };
      products.push(created);
      console.log(`[catalog-${INSTANCE}:${PORT}] created product #${created.id}`);
      return json(res, HttpStatus.CREATED, { product: created, ...meta });
    }

    json(res, HttpStatus.NOT_FOUND, { error: "Not found", ...meta });
  } catch (err) {
    json(res, HttpStatus.INTERNAL_SERVER_ERROR, { error: err.message, ...meta });
  }
});

server.listen(PORT, () => {
  console.log(`[catalog-${INSTANCE}] listening on http://localhost:${PORT}`);
});
