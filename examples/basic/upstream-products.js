/**
 * Example upstream: Products Service
 * Runs on http://localhost:4002
 *
 * The gateway proxies /products/* → this service with pathRewrite stripping /products,
 * so this service only needs to handle / and /:id.
 */

const http = require("http");
const HttpStatus = require("http-status").default;

const products = [
  { id: 1, name: "Widget", description: "A standard widget", price: 9.99, stock: 100 },
  { id: 2, name: "Gadget", description: "A fancy gadget", price: 24.99, stock: 50 },
  { id: 3, name: "Doohickey", description: "A classic doohickey", price: 4.99, stock: 200 },
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
    // GET / — list all products
    if (method === "GET" && parts.length === 0) {
      return json(res, HttpStatus.OK, { products, total: products.length });
    }

    // GET /:id — get product by id
    if (method === "GET" && parts.length === 1) {
      const product = products.find((p) => p.id === Number(parts[0]));
      if (!product) return json(res, HttpStatus.NOT_FOUND, { error: "Product not found" });
      return json(res, HttpStatus.OK, { product });
    }

    // POST / — create a product
    if (method === "POST" && parts.length === 0) {
      const body = await readBody(req);
      if (!body.name || body.price == null) {
        return json(res, HttpStatus.BAD_REQUEST, { error: "name and price are required" });
      }
      const created = { id: products.length + 1, stock: 0, ...body };
      products.push(created);
      return json(res, HttpStatus.CREATED, { product: created });
    }

    // PATCH /:id/stock — update stock quantity
    if (method === "PATCH" && parts.length === 2 && parts[1] === "stock") {
      const product = products.find((p) => p.id === Number(parts[0]));
      if (!product) return json(res, HttpStatus.NOT_FOUND, { error: "Product not found" });
      const { quantity } = await readBody(req);
      if (typeof quantity !== "number") {
        return json(res, HttpStatus.BAD_REQUEST, { error: "quantity must be a number" });
      }
      product.stock += quantity;
      return json(res, HttpStatus.OK, { product });
    }

    json(res, HttpStatus.NOT_FOUND, { error: "Not found" });
  } catch (err) {
    json(res, HttpStatus.BAD_REQUEST, { error: err.message });
  }
});

const PORT = Number(process.env.PRODUCTS_PORT || 4002);
server.listen(PORT, () => {
  console.log(`[products-service] listening on http://localhost:${PORT}`);
});
