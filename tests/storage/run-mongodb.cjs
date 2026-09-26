const { MongoMemoryReplSet } = require("mongodb-memory-server-core");
const { spawn } = require("node:child_process");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

async function main() {
  const server = await MongoMemoryReplSet.create({
    binary: { downloadDir: join(tmpdir(), "api-gateway-mongodb-binaries") },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["node_modules/vitest/vitest.mjs", "run", "tests/storage"],
        {
          stdio: "inherit",
          env: { ...process.env, TEST_MONGODB_URI: server.getUri() },
        },
      );
      child.on("error", reject);
      child.on("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    await server.stop();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
