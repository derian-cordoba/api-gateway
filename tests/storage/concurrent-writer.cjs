// A separate process exercises database locks rather than a process-local queue.
require(
  require.resolve("ts-node", {
    paths: [require.resolve("ts-node-dev/package.json")],
  }),
).register({ transpileOnly: true });
const {
  RouteStorageManager,
} = require("../../src/modules/route-configuration/infrastructure/RouteStorageManager");

process.once("message", async ({ config, expectedRevision }) => {
  const manager = new RouteStorageManager(config);
  try {
    const service = await manager.getService();
    await new Promise((resolve) => {
      process.once("message", resolve);
      process.send({ ready: true });
    });
    await service.write([], expectedRevision);
    process.send({ outcome: "saved" });
  } catch (error) {
    process.send({
      outcome:
        error.name === "ConfigurationConflictError" ? "conflict" : "error",
      message: error.message,
    });
  } finally {
    await manager.close();
    process.disconnect();
  }
});
