#!/usr/bin/env node
/**
 * Route-level CORS example — simple JSON API upstream.
 *
 * Returns a JSON response. CORS policy is entirely managed by the gateway;
 * this upstream has no CORS configuration of its own.
 *
 * Port: process.env.API_PORT (default 4061)
 */
"use strict";

const http = require("node:http");

const PORT = parseInt(process.env.API_PORT ?? "4061", 10);

const server = http.createServer((req, res) => {
  const route = req.url?.split("?")[0] ?? "/";
  res.setHeader("Content-Type", "application/json");

  const body = {
    message: "Hello from the upstream API",
    route,
    note: "CORS headers on this response are injected by the API gateway, not this server.",
    timestamp: new Date().toISOString(),
  };

  res.end(JSON.stringify(body, null, 2));
  console.log(`[api] ${req.method} ${req.url}`);
});

server.listen(PORT, () => {
  console.log(`[api] upstream listening on http://localhost:${PORT}`);
});
