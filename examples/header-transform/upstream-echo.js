#!/usr/bin/env node
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
"use strict";

const http = require("node:http");

const PORT = parseInt(process.env.ECHO_PORT ?? "4060", 10);
let requestCount = 0;

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    requestCount += 1;

    let parsedBody = null;
    const raw = Buffer.concat(chunks).toString();
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
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Server", "echo-upstream/1.0");          // gateway removes this
    res.setHeader("X-Custom-Upstream", "original-value");  // gateway overrides this

    res.end(JSON.stringify(payload, null, 2));

    console.log(`[echo] ${req.method} ${req.url} — request #${requestCount}`);
  });
});

server.listen(PORT, () => {
  console.log(`[echo] upstream listening on http://localhost:${PORT}`);
});
