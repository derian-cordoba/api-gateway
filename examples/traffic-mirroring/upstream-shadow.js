const { createServer, json, readRawBody } = require("../shared/http");

const port = Number(process.env.SHADOW_PORT ?? 4076);
let requests = 0;

createServer(async (req, res) => {
  if (req.method === "GET" && new URL(req.url, "http://localhost").pathname === "/stats") {
    return json(res, 200, { requests });
  }
  const rawBody = await readRawBody(req);
  json(res, 200, {
    mode: "mirror",
    requests: ++requests,
    method: req.method,
    path: req.url,
    body: rawBody.toString("utf8"),
  });
}).listen(port, () => console.log(`[mirror] listening on http://localhost:${port}`));
