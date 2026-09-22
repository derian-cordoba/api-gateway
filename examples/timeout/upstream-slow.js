const { createServer, json, readRawBody, delay } = require("../shared/http");

const port = Number(process.env.SLOW_PORT ?? 4073);
let requests = 0;

// The route deadline is 100 ms; the upstream takes 500 ms to respond.
createServer(async (req, res) => {
  const rawBody = await readRawBody(req);
  const requestNumber = ++requests;
  await delay(500);
  if (res.destroyed) return;

  json(res, 200, {
    mode: "timeout",
    requests: requestNumber,
    method: req.method,
    path: req.url,
    body: rawBody.toString("utf8"),
  });
}).listen(port, () => console.log(`[timeout] listening on http://localhost:${port}`));
