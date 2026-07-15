import { describe, it, expect } from "vitest";
import supertest from "supertest";
import express from "express";
import { matchesCidr, createIpFilterMiddleware } from "../../../src/apps/api-gateway/middleware/ipFilter";
import type { IpFilter } from "../../../src/apps/api-gateway/types/ip-filter";

// ── matchesCidr ───────────────────────────────────────────────────────────────

describe("matchesCidr", () => {
  describe("exact IP match (no CIDR notation)", () => {
    it("returns true for an identical IP", () => {
      expect(matchesCidr("192.168.1.1", "192.168.1.1")).toBe(true);
    });

    it("returns false for a different IP", () => {
      expect(matchesCidr("192.168.1.2", "192.168.1.1")).toBe(false);
    });
  });

  describe("CIDR range matching", () => {
    it("matches an IP inside a /24 range", () => {
      expect(matchesCidr("10.0.0.1", "10.0.0.0/24")).toBe(true);
      expect(matchesCidr("10.0.0.254", "10.0.0.0/24")).toBe(true);
    });

    it("does not match an IP outside a /24 range", () => {
      expect(matchesCidr("10.0.1.1", "10.0.0.0/24")).toBe(false);
    });

    it("matches the network address itself (/24)", () => {
      expect(matchesCidr("10.0.0.0", "10.0.0.0/24")).toBe(true);
    });

    it("matches an IP inside a /8 range", () => {
      expect(matchesCidr("10.255.255.254", "10.0.0.0/8")).toBe(true);
    });

    it("does not match an IP outside a /8 range", () => {
      expect(matchesCidr("11.0.0.1", "10.0.0.0/8")).toBe(false);
    });

    it("handles /32 (single host) — matching IP", () => {
      expect(matchesCidr("192.168.1.100", "192.168.1.100/32")).toBe(true);
    });

    it("handles /32 (single host) — non-matching IP", () => {
      expect(matchesCidr("192.168.1.101", "192.168.1.100/32")).toBe(false);
    });

    it("handles /0 — matches any IP", () => {
      expect(matchesCidr("1.2.3.4", "0.0.0.0/0")).toBe(true);
      expect(matchesCidr("255.255.255.255", "0.0.0.0/0")).toBe(true);
    });
  });
});

// ── createIpFilterMiddleware ──────────────────────────────────────────────────

function buildApp(config: IpFilter) {
  const app = express();
  // Force req.ip to be a predictable value for unit tests
  app.set("trust proxy", false);
  app.use((req, _res, next) => {
    // Override socket address so the middleware sees our test IP
    Object.defineProperty(req, "ip", { get: () => "192.168.1.50", configurable: true });
    next();
  });
  app.use(createIpFilterMiddleware(config));
  app.get("/test", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("createIpFilterMiddleware", () => {
  describe("allow list only", () => {
    it("passes when the client IP is in the allow list", async () => {
      const app = buildApp({ allow: ["192.168.1.50"] });
      const res = await supertest(app).get("/test");
      expect(res.status).toBe(200);
    });

    it("blocks when the client IP is NOT in the allow list", async () => {
      const app = buildApp({ allow: ["10.0.0.0/8"] });
      const res = await supertest(app).get("/test");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("passes when the client IP is within an allowed CIDR range", async () => {
      const app = buildApp({ allow: ["192.168.1.0/24"] });
      const res = await supertest(app).get("/test");
      expect(res.status).toBe(200);
    });
  });

  describe("deny list only", () => {
    it("blocks when the client IP is in the deny list", async () => {
      const app = buildApp({ deny: ["192.168.1.50"] });
      const res = await supertest(app).get("/test");
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });

    it("passes when the client IP is NOT in the deny list", async () => {
      const app = buildApp({ deny: ["10.0.0.0/8"] });
      const res = await supertest(app).get("/test");
      expect(res.status).toBe(200);
    });

    it("blocks when the client IP is within a denied CIDR range", async () => {
      const app = buildApp({ deny: ["192.168.0.0/16"] });
      const res = await supertest(app).get("/test");
      expect(res.status).toBe(403);
    });
  });

  describe("deny takes precedence over allow", () => {
    it("blocks the IP even when it appears in the allow list too", async () => {
      const app = buildApp({ allow: ["192.168.1.50"], deny: ["192.168.1.50"] });
      const res = await supertest(app).get("/test");
      expect(res.status).toBe(403);
    });

    it("blocks when IP is in deny CIDR but not in allow list", async () => {
      const app = buildApp({ allow: ["10.0.0.1"], deny: ["192.168.0.0/16"] });
      const res = await supertest(app).get("/test");
      expect(res.status).toBe(403);
    });
  });

  describe("IPv4-mapped IPv6 normalisation", () => {
    it("treats ::ffff:192.168.1.50 the same as 192.168.1.50", async () => {
      const app = express();
      app.set("trust proxy", false);
      app.use((req, _res, next) => {
        Object.defineProperty(req, "ip", { get: () => "::ffff:192.168.1.50", configurable: true });
        next();
      });
      app.use(createIpFilterMiddleware({ allow: ["192.168.1.50"] }));
      app.get("/test", (_req, res) => res.json({ ok: true }));

      const res = await supertest(app).get("/test");
      expect(res.status).toBe(200);
    });
  });
});
