/**
 * Example auth service — Issues JWT tokens
 * Runs on http://localhost:4003
 *
 * POST /login  { username, password } → { token, expiresIn }
 *
 * Uses the same JWT_SECRET as the gateway so the gateway can verify
 * tokens this service issues. In production the secret comes from a
 * secrets manager; here it is read from the .env copied to the root.
 */

require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");
const { StatusCodes: HttpStatus } = require("http-status-codes");

const USERS = [
  { id: 1, username: "alice", password: "password123", role: "admin" },
  { id: 2, username: "bob", password: "password456", role: "user" },
];

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = "1h";

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
  const { method, url } = req;

  try {
    if (method === "POST" && url === "/login") {
      const { username, password } = await readBody(req);

      if (!username || !password) {
        return json(res, HttpStatus.BAD_REQUEST, { error: "username and password are required" });
      }

      const user = USERS.find((u) => u.username === username && u.password === password);
      if (!user) {
        return json(res, HttpStatus.UNAUTHORIZED, { error: "Invalid credentials" });
      }

      if (!SECRET) {
        return json(res, HttpStatus.INTERNAL_SERVER_ERROR, { error: "JWT_SECRET is not configured" });
      }

      const token = jwt.sign(
        { sub: user.id, username: user.username, role: user.role },
        SECRET,
        { algorithm: "HS256", expiresIn: EXPIRES_IN }
      );

      return json(res, HttpStatus.OK, { token, expiresIn: EXPIRES_IN });
    }

    json(res, HttpStatus.NOT_FOUND, { error: "Not found" });
  } catch (err) {
    json(res, HttpStatus.BAD_REQUEST, { error: err.message });
  }
});

const PORT = Number(process.env.AUTH_PORT || 4003);
server.listen(PORT, () => {
  console.log(`[auth-service]     listening on http://localhost:${PORT}`);
});
