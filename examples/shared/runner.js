const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { delay } = require("./http");
const services = require("./services.json");

const root = path.resolve(__dirname, "../..");
const example = process.argv[2] ?? "all";
const combined = example === "all";
const children = new Set();
let stopping = false;

async function shutdown(code) {
  if (stopping) return;

  stopping = true;

  const pending = [...children].map((child) => new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  }));

  const deadline = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 3000);

  await Promise.all(pending);

  clearTimeout(deadline);

  process.exitCode = code;
}

function start(file, env) {
  const child = spawn(process.execPath, [path.join(root, file)], {
    cwd: root, env, stdio: "inherit",
  });
  
  children.add(child);
  
  child.once("error", (error) => {
    children.delete(child);
    console.error(error.message);
    void shutdown(1);
  });
  
  child.once("exit", (code, signal) => {
    children.delete(child);

    if (!stopping) {
      console.error(`${file} stopped unexpectedly (${signal ?? code}).`);
      void shutdown(1);
    }
  });
}

async function waitForPort(port) {
  for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
    const ready = await new Promise((resolve) => {
      const socket = net.connect({ port, host: "localhost" });
      socket.setTimeout(200);

      const finish = (value) => { socket.destroy(); resolve(value); };

      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.once("timeout", () => finish(false));
    });
    
    if (ready) return;

    await delay(100);
  }
  throw new Error(`Service on port ${port} did not become ready.`);
}

async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => reject(new Error(`Cannot listen on port ${port} (${error.code}); check permissions or whether another service owns it.`)));
    server.listen(port, () => server.close(resolve));
  });
}

async function main() {
  const selected = combined ? Object.values(services).flat() : services[example];
  if (!selected) throw new Error(`Unknown example: ${example}`);

  const gatewayPort = Number(process.env.GATEWAY_PORT ?? 3000);
  const ports = selected.flatMap((service) => Object.values(combined ? service.allPorts ?? service.ports : service.ports));

  await Promise.all([gatewayPort, ...ports].map(assertPortAvailable));

  if (stopping) return;

  const env = {
    ...process.env, NODE_ENV: "development",
    LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
    CORS_ORIGINS: "*",
    JWT_SECRET: "super-secret-key-change-in-production",
    GATEWAY_PORT: String(gatewayPort),
    ROUTES: "[]",
    ROUTES_FILE_PATH: path.join(root, "examples", combined ? "routes.json" : `${example}/routes.json`),
  };

  for (const service of selected) {
    const ports = combined ? service.allPorts ?? service.ports : service.ports;
    start(`examples/${service.file}`, {
      ...env,
      ...service.env,
      ...Object.fromEntries(
          Object.entries(ports).map(([key, value]) => [key, String(value)]),
      ),
    });
  }

  await Promise.all(ports.map(waitForPort));

  if (stopping) return;

  start("dist/src/apps/api-gateway/index.js", env);

  await waitForPort(gatewayPort);

  if (stopping) return;

  console.log(`\n${example} example ready. Press Ctrl+C to stop.\nGateway: http://localhost:${gatewayPort}`);

  for (const route of JSON.parse(readFileSync(env.ROUTES_FILE_PATH, "utf8"))) {
    console.log(`  ${route.baseURL}`);
  }

  console.log("See examples/README.md for requests and expected responses.");
}

process.once("SIGINT", () => void shutdown(0));
process.once("SIGTERM", () => void shutdown(0));

main().catch((error) => { console.error(error.message); void shutdown(1); });
