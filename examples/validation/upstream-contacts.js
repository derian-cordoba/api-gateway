const { createServer } = require("../shared/http");
const { createEchoHandler } = require("../shared/echo");

const port = Number(process.env.CONTACTS_PORT ?? 4071);

// The gateway validates required fields, content type, and body size before forwarding.
createServer(createEchoHandler("validation"))
  .listen(port, () => console.log(`[validation] listening on http://localhost:${port}`));
