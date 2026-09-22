const http = require("node:http");
const { setTimeout: delay } = require("node:timers/promises");

function json(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(data, null, 2));
}

function readRawBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > maxBytes) {
        reject(Object.assign(
          new Error("Request body too large"),
          { statusCode: 413 },
        ));
      } else {
        chunks.push(Buffer.from(chunk));
      }
    });

    req.once("end", () => resolve(Buffer.concat(chunks)));
    req.once("error", reject);
    req.once("aborted", () => reject(new Error("Request aborted")));
  });
}

async function readBody(req) {
  const raw = (await readRawBody(req)).toString("utf8");
  if (!raw) return {};

  if (req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(
      new Error("Invalid JSON body"),
      { statusCode: 400 },
    );
  }
}

function createServer(handler) {
  return http.createServer((req, res) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((error) => {
        if (!res.headersSent && !res.destroyed) {
          json(res, error.statusCode ?? 500, { error: error.message });
        } else {
          res.destroy();
        }
      });
  });
}

function pathParts(req) {
  return new URL(req.url, "http://localhost")
    .pathname
    .split("/")
    .filter(Boolean);
}

module.exports = { createServer, json, readBody, readRawBody, pathParts, delay };
