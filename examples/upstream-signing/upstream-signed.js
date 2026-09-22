const { createHmac, timingSafeEqual } = require("node:crypto");
const { createServer, json, readRawBody } = require("../shared/http");

const port = Number(process.env.SIGNED_PORT ?? 4074);
const secret = "example-upstream-secret";
let requests = 0;

createServer(async (req, res) => {
  const rawBody = await readRawBody(req);
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const signature = req.headers["x-gateway-signature"];
  const actual = Buffer.from(typeof signature === "string" ? signature : "");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return json(res, 401, { error: "Invalid gateway signature" });
  }

  json(res, 200, {
    mode: "upstream-signing",
    requests: ++requests,
    method: req.method,
    path: req.url,
    body: rawBody.toString("utf8"),
  });
}).listen(port, () => console.log(`[upstream-signing] listening on http://localhost:${port}`));
