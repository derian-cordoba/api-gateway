const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { createHmac } = require("node:crypto");
const { delay } = require("./http");

async function main() {
  const child = spawn(process.execPath, [require.resolve("./runner"), "all"], {
    env: { ...process.env, GATEWAY_PORT: "3099", LOG_LEVEL: "silent" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";

  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  const exited = once(child, "exit");
  const request = async (path, status, options) => {
    const response = await fetch(`http://localhost:3099${path}`, {
      ...options,
      signal: AbortSignal.timeout(5000),
    });

    const body = await response.text();
    assert.equal(response.status, status, `${path}: ${body}`);

    return { response, body };
  };

  const post = { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"name":"Alice","email":"alice@example.com"}' };

  try {
    for (let i = 0; i < 150 && !output.includes("all example ready"); i++) {
      if (child.exitCode !== null) throw new Error(output);
      await delay(100);
    }

    assert.match(output, /all example ready/, output);

    const conflict = spawn(process.execPath, [require.resolve("./runner"), "basic"], {
      env: { ...process.env, GATEWAY_PORT: "3099" }, stdio: "ignore",
    });

    const [conflictCode] = await once(conflict, "exit");

    assert.equal(conflictCode, 1, "A busy port must fail without terminating its owner");

    for (const path of ["/users?limit=1", "/products", "/inventory", "/analytics/public", "/catalog", "/retry-inventory", "/cached-catalog", "/metrics-orders", "/echo", "/public-api"]) {
      await request(path, 200);
    }

    await request("/reports", 401);

    await request("/reports", 200, { headers: { "x-api-key": "key-service-alpha-123" } });

    const login = await request("/auth/login", 200, { ...post, body: '{"username":"alice","password":"password123"}' });

    await request("/orders", 200, { headers: { Authorization: `Bearer ${JSON.parse(login.body).token}` } });

    const oauth = await request("/oauth2-auth/login", 200, {
      ...post,
      body: '{"username":"alice","password":"password123"}',
    });

    await request("/oauth2-protected", 200, {
      headers: {
        Authorization: `Bearer ${JSON.parse(oauth.body).access_token}`,
      },
    });
    await request("/basic-auth", 401);
    await request("/basic-auth", 200, {
      headers: {
        Authorization: `Basic ${Buffer.from("alice:password123").toString("base64")}`,
      },
    });
    await request("/validated", 200, post);
    await request("/validated", 422, { ...post, body: "{}" });
    await request("/slow", 504);
    await request("/signed", 200, post);

    const direct = await fetch("http://localhost:4074", post);

    assert.equal(direct.status, 401);

    await direct.text();
    await request("/mirrored", 200, post);

    let mirrored = 0;

    for (let i = 0; i < 20 && !mirrored; i++) {
      await delay(50);
      const response = await fetch("http://localhost:4076/stats");
      const json = await response.json();
      mirrored = json.requests;
    }

    assert.ok(mirrored > 0);

    for (const provider of ["github", "stripe", "custom"]) {
      const digest = createHmac("sha256", "example-webhook-secret")
        .update(provider === "stripe" ? `1700000000.${post.body}` : post.body)
        .digest("hex");

      const header = provider === "github" ? "x-hub-signature-256" : provider === "stripe" ? "stripe-signature" : "x-example-signature";
      const signature = provider === "github" ? `sha256=${digest}` : provider === "stripe" ? `t=1700000000,v1=${digest}` : digest;

      await request(`/webhooks/${provider}`, 200, {
        ...post, 
        headers: { ...post.headers, [header]: signature },
      });

      await request(`/webhooks/${provider}`, 401, {
        ...post,
        headers: { ...post.headers, [header]: "invalid" },
      });
    }

    console.log("Example smoke checks passed.");
  } finally {
    child.kill("SIGTERM");
    await exited;
  }
}

async function standaloneChecks() {
  for (const name of Object.keys(require("./services.json"))) {
    const child = spawn(process.execPath, [require.resolve("./runner"), name], {
      env: { ...process.env, GATEWAY_PORT: "3099", LOG_LEVEL: "silent" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });

    const exited = once(child, "exit");

    try {
      for (let i = 0; i < 100 && !output.includes(`${name} example ready`); i++) {
        if (child.exitCode !== null) throw new Error(output);
        await delay(100);
      }

      assert.ok(output.includes(`${name} example ready`), output);
    } finally {
      child.kill("SIGTERM");
      await exited;
    }
  }

  console.log("All standalone examples started and stopped successfully.");
}

main()
  .then(standaloneChecks)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
