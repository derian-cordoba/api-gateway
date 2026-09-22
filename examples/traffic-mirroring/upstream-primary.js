const { createServer } = require("../shared/http");
const { createEchoHandler } = require("../shared/echo");

const port = Number(process.env.PRIMARY_PORT ?? 4075);

// The gateway forwards this response and independently copies traffic to the shadow.
createServer(createEchoHandler("traffic-mirroring"))
  .listen(port, () => console.log(`[traffic-mirroring] listening on http://localhost:${port}`));
