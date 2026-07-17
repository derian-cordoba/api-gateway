import { describe, it, expect, vi, afterEach } from "vitest";
import { ResponseCache } from "../../../../src/apps/api-gateway/middleware/cache/ResponseCache";

afterEach(() => {
  vi.useRealTimers();
});

const entry = {
  status: 200,
  headers: { "content-type": "application/json" },
  body: Buffer.from('{"ok":true}'),
};

describe("ResponseCache.isCacheable", () => {
  it("returns true for GET 200 by default", () => {
    const cache = new ResponseCache({ ttl: 5000 });
    expect(cache.isCacheable("GET", 200)).toBe(true);
  });

  it("returns true for HEAD 200 by default", () => {
    const cache = new ResponseCache({ ttl: 5000 });
    expect(cache.isCacheable("HEAD", 200)).toBe(true);
  });

  it("returns false for POST 200 by default", () => {
    const cache = new ResponseCache({ ttl: 5000 });
    expect(cache.isCacheable("POST", 200)).toBe(false);
  });

  it("returns false for GET 201 (not in default cacheable codes)", () => {
    const cache = new ResponseCache({ ttl: 5000 });
    expect(cache.isCacheable("GET", 201)).toBe(false);
  });

  it("respects custom methods", () => {
    const cache = new ResponseCache({ ttl: 5000, methods: ["POST"] });
    expect(cache.isCacheable("POST", 200)).toBe(true);
    expect(cache.isCacheable("GET", 200)).toBe(false);
  });

  it("respects custom statusCodes", () => {
    const cache = new ResponseCache({ ttl: 5000, statusCodes: [201] });
    expect(cache.isCacheable("GET", 201)).toBe(true);
    expect(cache.isCacheable("GET", 200)).toBe(false);
  });
});

describe("ResponseCache.get / set", () => {
  it("returns null for unknown key", () => {
    const cache = new ResponseCache({ ttl: 5000 });
    expect(cache.get("GET:/foo")).toBeNull();
  });

  it("returns entry after set", () => {
    const cache = new ResponseCache({ ttl: 5000 });
    cache.set("GET:/foo", entry);
    const result = cache.get("GET:/foo");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(200);
    expect(result!.body.toString()).toBe('{"ok":true}');
  });

  it("returns null after TTL expires", () => {
    vi.useFakeTimers();
    const cache = new ResponseCache({ ttl: 1000 });
    cache.set("GET:/foo", entry);
    expect(cache.get("GET:/foo")).not.toBeNull();
    vi.advanceTimersByTime(1001);
    expect(cache.get("GET:/foo")).toBeNull();
  });

  it("size() counts only non-expired entries", () => {
    vi.useFakeTimers();
    const cache = new ResponseCache({ ttl: 1000 });
    cache.set("GET:/a", entry);
    cache.set("GET:/b", entry);
    expect(cache.size()).toBe(2);
    vi.advanceTimersByTime(1001);
    expect(cache.size()).toBe(0);
  });
});

describe("ResponseCache.clear", () => {
  it("removes all entries", () => {
    const cache = new ResponseCache({ ttl: 5000 });
    cache.set("GET:/x", entry);
    cache.clear();
    expect(cache.get("GET:/x")).toBeNull();
    expect(cache.size()).toBe(0);
  });
});
