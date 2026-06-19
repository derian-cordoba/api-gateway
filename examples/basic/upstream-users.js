/**
 * Example upstream: Users Service
 * Runs on http://localhost:4001
 *
 * The gateway proxies /users/* → this service with pathRewrite stripping /users,
 * so this service only needs to handle / and /:id.
 */

const http = require("http");
const { StatusCodes: HttpStatus } = require("http-status-codes");

const users = [
  { id: 1, name: "Alice Doe", email: "alice@example.com", role: "admin" },
  { id: 2, name: "Bob Smith", email: "bob@example.com", role: "user" },
  { id: 3, name: "Carol White", email: "carol@example.com", role: "user" },
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
    // GET / — list all users
    if (method === "GET" && parts.length === 0) {
      return json(res, HttpStatus.OK, { users, total: users.length });
    }

    // GET /:id — get user by id
    if (method === "GET" && parts.length === 1) {
      const user = users.find((u) => u.id === Number(parts[0]));
      if (!user) return json(res, HttpStatus.NOT_FOUND, { error: "User not found" });
      return json(res, HttpStatus.OK, { user });
    }

    // POST / — create a user
    if (method === "POST" && parts.length === 0) {
      const body = await readBody(req);
      if (!body.name || !body.email) {
        return json(res, HttpStatus.BAD_REQUEST, { error: "name and email are required" });
      }
      const created = { id: users.length + 1, role: "user", ...body };
      users.push(created);
      return json(res, HttpStatus.CREATED, { user: created });
    }

    // DELETE /:id — remove a user
    if (method === "DELETE" && parts.length === 1) {
      const idx = users.findIndex((u) => u.id === Number(parts[0]));
      if (idx === -1) return json(res, HttpStatus.NOT_FOUND, { error: "User not found" });
      const [removed] = users.splice(idx, 1);
      return json(res, HttpStatus.OK, { user: removed });
    }

    json(res, HttpStatus.NOT_FOUND, { error: "Not found" });
  } catch (err) {
    json(res, HttpStatus.BAD_REQUEST, { error: err.message });
  }
});

const PORT = Number(process.env.USERS_PORT || 4001);
server.listen(PORT, () => {
  console.log(`[users-service]    listening on http://localhost:${PORT}`);
});
