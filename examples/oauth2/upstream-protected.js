#!/usr/bin/env node
/**
 * OAuth 2.0 example — protected upstream API.
 *
 * This service has no auth logic of its own — the API gateway handles
 * OAuth 2.0 token introspection before forwarding the request here.
 *
 * Port: process.env.API_PORT (default 4063)
 */
"use strict";

const http = require("node:http");

const PORT = parseInt(process.env.API_PORT ?? "4063", 10);

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");

  const body = {
    message: "Welcome to the protected API",
    note: "You reached here because the gateway validated your Bearer token via OAuth 2.0 introspection.",
    forwardedBy: req.headers["x-forwarded-by"] ?? "unknown",
    requestId: req.headers["x-request-id"] ?? null,
    timestamp: new Date().toISOString(),
  };

  res.end(JSON.stringify(body, null, 2));
  console.log(`[protected-api] ${req.method} ${req.url}`);
});

server.listen(PORT, () => {
  console.log(`[protected-api] upstream listening on http://localhost:${PORT}`);
});
