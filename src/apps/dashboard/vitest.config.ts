import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@gateway": fileURLToPath(new URL("../api-gateway", import.meta.url)),
      "@shared": fileURLToPath(new URL("../../shared", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    environmentOptions: {
      jsdom: { url: "http://localhost:3001" },
    },
    include: ["src/test/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
