const { createServer } = require("../shared/http");
const { createEchoHandler } = require("../shared/echo");

const port = Number(process.env.BASIC_AUTH_PORT ?? 4070);

// The gateway checks Basic credentials before forwarding requests here.
createServer(createEchoHandler("basic-auth"))
  .listen(port, () => console.log(`[basic-auth] listening on http://localhost:${port}`));
