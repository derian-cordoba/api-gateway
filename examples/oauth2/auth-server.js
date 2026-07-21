#!/usr/bin/env node
/**
 * OAuth 2.0 example — mock authorization server.
 *
 * Implements two endpoints:
 *   POST /login       — issues an opaque bearer token
 *   POST /introspect  — RFC 7662 token introspection
 *
 * The gateway calls /introspect with HTTP Basic auth using
 * clientId "gateway-client" / clientSecret "gw-s3cr3t".
 *
 * Port: process.env.AUTH_PORT (default 4062)
 */
"use strict";

const http = require("node:http");

const PORT = parseInt(process.env.AUTH_PORT ?? "4062", 10);

// ── Valid users ───────────────────────────────────────────────────────────────
const USERS = {
  alice: "password123",
  bob: "password456",
};

// ── Gateway client credentials (for introspection auth) ───────────────────────
const GATEWAY_CLIENT_ID = "gateway-client";
const GATEWAY_CLIENT_SECRET = "gw-s3cr3t";

// ── In-memory token store: token → { sub, issuedAt } ─────────────────────────
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
const tokens = new Map();

function generateToken() {
  return "tok_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      const ct = req.headers["content-type"] ?? "";
      try {
        if (ct.includes("application/x-www-form-urlencoded")) {
          resolve(Object.fromEntries(new URLSearchParams(raw)));
        } else {
          resolve(JSON.parse(raw || "{}"));
        }
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

// ── POST /login ───────────────────────────────────────────────────────────────
async function handleLogin(req, res) {
  const body = await parseBody(req);
  const { username, password } = body;

  if (!username || !password || USERS[username] !== password) {
    return json(res, 401, { error: "invalid_credentials" });
  }

  const token = generateToken();
  tokens.set(token, { sub: username, issuedAt: Date.now() });
  console.log(`[auth] issued token for ${username}: ${token}`);

  json(res, 200, {
    access_token: token,
    token_type: "Bearer",
    expires_in: TOKEN_TTL_MS / 1000,
  });
}

// ── POST /introspect ──────────────────────────────────────────────────────────
// Called by the API gateway. Requires HTTP Basic auth with gateway credentials.
async function handleIntrospect(req, res) {
  // Validate gateway client credentials
  const authHeader = req.headers["authorization"] ?? "";
  if (!authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Auth Server"');
    return json(res, 401, { error: "client_not_authenticated" });
  }

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
  const [id, secret] = decoded.split(":");
  if (id !== GATEWAY_CLIENT_ID || secret !== GATEWAY_CLIENT_SECRET) {
    return json(res, 401, { error: "client_not_authenticated" });
  }

  // Validate the token
  const body = await parseBody(req);
  const token = body.token;
  const entry = token ? tokens.get(token) : null;

  if (!entry) {
    console.log(`[auth] introspect — token not found: ${token}`);
    return json(res, 200, { active: false });
  }

  if (Date.now() - entry.issuedAt > TOKEN_TTL_MS) {
    tokens.delete(token);
    console.log(`[auth] introspect — token expired: ${token}`);
    return json(res, 200, { active: false });
  }

  console.log(`[auth] introspect — token active for sub=${entry.sub}`);
  json(res, 200, {
    active: true,
    sub: entry.sub,
    token_type: "Bearer",
    exp: Math.floor((entry.issuedAt + TOKEN_TTL_MS) / 1000),
    iat: Math.floor(entry.issuedAt / 1000),
  });
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/login") {
      await handleLogin(req, res);
    } else if (req.method === "POST" && req.url === "/introspect") {
      await handleIntrospect(req, res);
    } else {
      json(res, 404, { error: "not_found" });
    }
  } catch (err) {
    console.error("[auth] error:", err);
    json(res, 500, { error: "server_error" });
  }
});

server.listen(PORT, () => {
  console.log(`[auth] authorization server listening on http://localhost:${PORT}`);
  console.log(`[auth] gateway client: ${GATEWAY_CLIENT_ID} / ${GATEWAY_CLIENT_SECRET}`);
});
