#!/usr/bin/env node
"use strict";

const { createServer, json, readRawBody } = require("../shared/http");
/**
 * Header transform example — echo upstream.
 *
 * Returns a JSON snapshot of everything the upstream received:
 * method, URL, headers (after gateway transforms), and body.
 * Also appends two response headers so the response-transform demo
 * can show Server removal and X-Frame-Options injection.
 *
 * Port: process.env.ECHO_PORT (default 4060)
 */

const PORT = parseInt(process.env.ECHO_PORT ?? "4060", 10);
let requestCount = 0;

const server = createServer(async (req, res) => {
  requestCount += 1;

  let parsedBody = null;
  const raw = (await readRawBody(req)).toString("utf8");
  if (raw) {
    try {
      parsedBody = JSON.parse(raw);
    } catch {
      parsedBody = raw;
    }
  }

  const payload = {
    requestCount,
    method: req.method,
    url: req.url,
    // These are the headers the upstream actually received.
    // Compare them against the original client headers to confirm
    // that the gateway's request.headers transforms were applied.
    receivedHeaders: req.headers,
    body: parsedBody,
  };

  // Add response headers that the gateway's response.headers transform
  // should strip or override on the way back to the client.
  json(res, 200, payload, {
    Server: "echo-upstream/1.0",
    "X-Custom-Upstream": "original-value",
  });

  console.log(`[echo] ${req.method} ${req.url} — request #${requestCount}`);
});

server.listen(PORT, () => {
  console.log(`[echo] upstream listening on http://localhost:${PORT}`);
});
