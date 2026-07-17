/**
 * Example upstream: Product Catalog Service
 *
 * API  →  http://localhost:4020  (proxied by the gateway at /catalog)
 *
 * Each response includes an X-Request-Count header that increments on every
 * real upstream call. If the gateway is serving from cache, the upstream count
 * stays flat — proving that the cache is absorbing repeated reads.
 *
 * The service deliberately delays product-list responses by 200 ms to make it
 * easy to see the latency difference between cache hits and cache misses.
 *
 * Endpoints:
 *   GET  /           list all products (cached, 200 ms upstream latency)
 *   GET  /:id        single product    (cached, instant)
 *   POST /           create product    (NOT cached — POST is not idempotent)
 */

const http = require("http");

// ── State ──────────────────────────────────────────────────────────────────

let requestCount = 0;

const products = [
  { id: 1, name: "Wireless Headphones", price: 79.99,  category: "electronics", inStock: true  },
  { id: 2, name: "Mechanical Keyboard",  price: 129.99, category: "electronics", inStock: true  },
  { id: 3, name: "Ergonomic Mouse",      price: 49.99,  category: "electronics", inStock: false },
  { id: 4, name: "USB-C Hub",            price: 34.99,  category: "electronics", inStock: true  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function json(res, status, data) {
  requestCount++;
  res.writeHead(status, {
    "Content-Type": "application/json",
    "X-Request-Count": String(requestCount),
  });
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Server ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const parts = req.url.split("?")[0].split("/").filter(Boolean);

  try {
    // GET / — list all products (simulated 200 ms latency)
    if (method === "GET" && parts.length === 0) {
      await delay(200);
      console.log(`[catalog] GET /products — request #${requestCount + 1}`);
      return json(res, 200, { products, total: products.length });
    }

    // GET /:id — single product
    if (method === "GET" && parts.length === 1) {
      const product = products.find((p) => p.id === Number(parts[0]));
      if (!product) return json(res, 404, { error: "Product not found" });
      console.log(`[catalog] GET /products/${parts[0]} — request #${requestCount + 1}`);
      return json(res, 200, { product });
    }

    // POST / — create a product (not cached)
    if (method === "POST" && parts.length === 0) {
      const body = await readBody(req);
      if (!body.name || !body.price) {
        return json(res, 400, { error: "name and price are required" });
      }
      const created = { id: products.length + 1, inStock: true, category: "general", ...body };
      products.push(created);
      console.log(`[catalog] POST /products — created #${created.id}, request #${requestCount + 1}`);
      return json(res, 201, { product: created });
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

const PORT = Number(process.env.CATALOG_PORT || 4020);
server.listen(PORT, () => {
  console.log(`[catalog] listening on http://localhost:${PORT}`);
});
