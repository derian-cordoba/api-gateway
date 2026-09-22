const { createServer } = require("../shared/http");
const { createEchoHandler } = require("../shared/echo");

const port = Number(process.env.EVENTS_PORT ?? 4072);

// The gateway verifies provider signatures; this service receives accepted events.
createServer(createEchoHandler("webhook"))
  .listen(port, () => console.log(`[webhook] listening on http://localhost:${port}`));
