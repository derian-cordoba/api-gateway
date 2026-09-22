#!/usr/bin/env node
"use strict";

const { createServer, json } = require("../shared/http");
/**
 * Route-level CORS example — simple JSON API upstream.
 *
 * Returns a JSON response. CORS policy is entirely managed by the gateway;
 * this upstream has no CORS configuration of its own.
 *
 * Port: process.env.API_PORT (default 4061)
 */

const PORT = parseInt(process.env.API_PORT ?? "4061", 10);

const server = createServer((req, res) => {
  const route = req.url?.split("?")[0] ?? "/";

  const body = {
    message: "Hello from the upstream API",
    route,
    note: "CORS headers on this response are injected by the API gateway, not this server.",
    timestamp: new Date().toISOString(),
  };

  json(res, 200, body);
  console.log(`[api] ${req.method} ${req.url}`);
});

server.listen(PORT, () => {
  console.log(`[api] upstream listening on http://localhost:${PORT}`);
});
