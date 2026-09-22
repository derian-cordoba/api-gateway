const { json, readRawBody } = require("./http");

function createEchoHandler(mode) {
  let requests = 0;
  return async (req, res) => {
    const rawBody = await readRawBody(req);
    json(res, 200, {
      mode,
      requests: ++requests,
      method: req.method,
      path: req.url,
      body: rawBody.toString("utf8"),
    });
  };
}

module.exports = { createEchoHandler };
