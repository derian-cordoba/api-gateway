const { createHmac } = require("node:crypto");

async function main() {
  const provider = process.argv[2] ?? "github";

  if (!["github", "stripe", "custom"].includes(provider)) {
    throw new Error("Usage: node examples/webhook/send.js [github|stripe|custom]");
  }

  const body = JSON.stringify({ event: "example.created" });
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", "example-webhook-secret")
    .update(provider === "stripe" ? `${timestamp}.${body}` : body).digest("hex");
  const headers = { "Content-Type": "application/json" };

  if (provider === "github") headers["x-hub-signature-256"] = `sha256=${digest}`;

  if (provider === "stripe") headers["stripe-signature"] = `t=${timestamp},v1=${digest}`;

  if (provider === "custom") headers["x-example-signature"] = digest;

  const response = await fetch(`http://localhost:${process.env.GATEWAY_PORT ?? 3000}/webhooks/${provider}`, {
    method: "POST", headers, body, signal: AbortSignal.timeout(5000),
  });

  console.log(response.status, await response.text());

  if (!response.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
