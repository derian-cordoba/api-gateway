import { describe, expect, it } from "vitest";
import { RedisCacheStore } from "../../../src/apps/api-gateway/middleware/redis/RedisCacheStore";
import type { CacheEntry } from "../../../src/apps/api-gateway/middleware/cache/ResponseCache";

describe("RedisCacheStore", () => {
  it("restores a cached response body as a Buffer", async () => {
    const values = new Map<string, string>();
    const store = new RedisCacheStore<CacheEntry>({
      get: async (key) => values.get(key) ?? null,
      set: async (key, value) => { values.set(key, value); },
      del: async (...keys) => { keys.forEach((key) => values.delete(key)); return keys.length; },
      keys: async () => [...values.keys()],
    });
    const entry: CacheEntry = {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from([0, 255, 42]),
      freshUntil: Date.now() + 1000,
      expiresAt: Date.now() + 1000,
    };

    await store.set("binary", entry);
    const restored = await store.get("binary");
    expect(Buffer.isBuffer(restored?.body)).toBe(true);
    expect(restored?.body).toEqual(entry.body);
  });
});
