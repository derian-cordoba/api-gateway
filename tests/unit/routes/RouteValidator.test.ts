import { describe, it, expect } from "vitest";
import { validateRoutes } from "../../../src/apps/api-gateway/routes/RouteValidator";

const validRoute = {
  baseURL: "/api",
  proxy: { target: "http://localhost:3001" },
};

describe("validateRoutes", () => {
  describe("valid configs", () => {
    it("accepts a minimal valid route", () => {
      const result = validateRoutes([validRoute]);
      expect(result).toHaveLength(1);
      expect(result[0].baseURL).toBe("/api");
      expect(result[0].proxy.target).toBe("http://localhost:3001");
    });

    it("accepts multiple routes", () => {
      const routes = [
        { baseURL: "/users", proxy: { target: "http://localhost:3001" } },
        { baseURL: "/products", proxy: { target: "http://localhost:3002" } },
      ];
      expect(validateRoutes(routes)).toHaveLength(2);
    });

    it("accepts an empty array", () => {
      expect(validateRoutes([])).toEqual([]);
    });

    it("accepts all optional proxy fields", () => {
      const [route] = validateRoutes([
        {
          baseURL: "/api",
          proxy: {
            target: "http://localhost:3001",
            changeOrigin: true,
            isSecure: false,
            pathRewrite: { "^/api": "" },
            headers: { "X-Source": "gateway" },
            method: "GET",
            timeout: 5000,
          },
        },
      ]);
      expect(route.proxy.changeOrigin).toBe(true);
      expect(route.proxy.pathRewrite).toEqual({ "^/api": "" });
      expect(route.proxy.timeout).toBe(5000);
    });

    it("accepts a fully configured rateLimit", () => {
      const [route] = validateRoutes([
        {
          ...validRoute,
          rateLimit: { max: 100, windowMs: 60000, statusCode: 429, message: "slow down" },
        },
      ]);
      expect(route.rateLimit).toEqual({
        max: 100,
        windowMs: 60000,
        statusCode: 429,
        message: "slow down",
      });
    });

    it("accepts rateLimit with only required fields", () => {
      const [route] = validateRoutes([
        { ...validRoute, rateLimit: { max: 10, windowMs: 1000 } },
      ]);
      expect(route.rateLimit?.max).toBe(10);
      expect(route.rateLimit?.windowMs).toBe(1000);
    });
  });

  describe("invalid configs", () => {
    it("throws when proxy.target is missing", () => {
      expect(() =>
        validateRoutes([{ baseURL: "/api", proxy: {} }])
      ).toThrow();
    });

    it("throws when proxy.target is not a valid URL", () => {
      expect(() =>
        validateRoutes([{ baseURL: "/api", proxy: { target: "not-a-url" } }])
      ).toThrow("Proxy target must be a valid URL");
    });

    it("throws when baseURL does not start with /", () => {
      expect(() =>
        validateRoutes([{ baseURL: "api", proxy: { target: "http://localhost:3001" } }])
      ).toThrow("baseURL must start with /");
    });

    it("throws when rateLimit.max is zero", () => {
      expect(() =>
        validateRoutes([
          { ...validRoute, rateLimit: { max: 0, windowMs: 60000 } },
        ])
      ).toThrow("Rate limit max must be a positive number");
    });

    it("throws when rateLimit.windowMs is negative", () => {
      expect(() =>
        validateRoutes([
          { ...validRoute, rateLimit: { max: 10, windowMs: -1 } },
        ])
      ).toThrow("Rate limit windowMs must be a positive number");
    });

    it("throws when proxy.timeout is not positive", () => {
      expect(() =>
        validateRoutes([
          { baseURL: "/api", proxy: { target: "http://localhost:3001", timeout: 0 } },
        ])
      ).toThrow("Proxy timeout must be a positive number");
    });

    it("includes all failing fields in the error message", () => {
      expect(() =>
        validateRoutes([
          { baseURL: "no-slash", proxy: { target: "bad-url" } },
        ])
      ).toThrow("Invalid route configuration:");
    });
  });

  describe("auth field", () => {
    it("accepts JWT auth with only secret", () => {
      const [route] = validateRoutes([
        { ...validRoute, auth: { enabled: true, strategy: "jwt", secret: "my-secret" } },
      ]);
      expect(route.auth).toMatchObject({ enabled: true, strategy: "jwt", secret: "my-secret" });
    });

    it("accepts JWT auth with only publicKey", () => {
      const [route] = validateRoutes([
        { ...validRoute, auth: { enabled: true, strategy: "jwt", publicKey: "-----BEGIN PUBLIC KEY-----" } },
      ]);
      expect(route.auth).toMatchObject({ strategy: "jwt", publicKey: "-----BEGIN PUBLIC KEY-----" });
    });

    it("accepts JWT auth with both secret and publicKey", () => {
      const [route] = validateRoutes([
        {
          ...validRoute,
          auth: { enabled: true, strategy: "jwt", secret: "s", publicKey: "pk", algorithms: ["RS256"] },
        },
      ]);
      expect(route.auth).toMatchObject({ algorithms: ["RS256"] });
    });

    it("accepts JWT auth with enabled: false (passthrough)", () => {
      const [route] = validateRoutes([
        { ...validRoute, auth: { enabled: false, strategy: "jwt" } },
      ]);
      expect(route.auth).toMatchObject({ enabled: false, strategy: "jwt" });
    });

    it("accepts apiKey auth with required keys", () => {
      const [route] = validateRoutes([
        { ...validRoute, auth: { enabled: true, strategy: "apiKey", keys: ["k1", "k2"] } },
      ]);
      expect(route.auth).toMatchObject({ strategy: "apiKey", keys: ["k1", "k2"] });
    });

    it("accepts apiKey auth with a custom header", () => {
      const [route] = validateRoutes([
        { ...validRoute, auth: { enabled: true, strategy: "apiKey", header: "x-gateway-key", keys: ["k1"] } },
      ]);
      expect(route.auth).toMatchObject({ header: "x-gateway-key" });
    });

    it("throws when apiKey auth has an empty keys array", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, auth: { enabled: true, strategy: "apiKey", keys: [] } }])
      ).toThrow("apiKey auth requires at least one key");
    });

    it("throws when strategy is an unrecognized value", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, auth: { enabled: true, strategy: "oauth" } }])
      ).toThrow();
    });
  });

  describe("circuitBreaker field", () => {
    it("accepts a minimal circuitBreaker config (threshold + timeout)", () => {
      const [route] = validateRoutes([
        { ...validRoute, circuitBreaker: { threshold: 5, timeout: 30_000 } },
      ]);
      expect(route.circuitBreaker).toEqual({ threshold: 5, timeout: 30_000 });
    });

    it("accepts circuitBreaker with all fields including successThreshold", () => {
      const [route] = validateRoutes([
        { ...validRoute, circuitBreaker: { threshold: 3, timeout: 10_000, successThreshold: 2 } },
      ]);
      expect(route.circuitBreaker).toEqual({ threshold: 3, timeout: 10_000, successThreshold: 2 });
    });

    it("omitting circuitBreaker leaves it undefined", () => {
      const [route] = validateRoutes([validRoute]);
      expect(route.circuitBreaker).toBeUndefined();
    });

    it("throws when threshold is zero", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, circuitBreaker: { threshold: 0, timeout: 10_000 } }])
      ).toThrow("Circuit breaker threshold must be a positive integer");
    });

    it("throws when threshold is negative", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, circuitBreaker: { threshold: -1, timeout: 10_000 } }])
      ).toThrow("Circuit breaker threshold must be a positive integer");
    });

    it("throws when timeout is zero", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, circuitBreaker: { threshold: 3, timeout: 0 } }])
      ).toThrow("Circuit breaker timeout must be a positive number");
    });

    it("throws when timeout is negative", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, circuitBreaker: { threshold: 3, timeout: -5000 } }])
      ).toThrow("Circuit breaker timeout must be a positive number");
    });

    it("throws when successThreshold is zero", () => {
      expect(() =>
        validateRoutes([
          { ...validRoute, circuitBreaker: { threshold: 3, timeout: 10_000, successThreshold: 0 } },
        ])
      ).toThrow("Circuit breaker successThreshold must be a positive integer");
    });

    it("throws when threshold is missing", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, circuitBreaker: { timeout: 10_000 } }])
      ).toThrow();
    });

    it("throws when timeout is missing", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, circuitBreaker: { threshold: 3 } }])
      ).toThrow();
    });
  });

  describe("ipFilter field", () => {
    it("accepts ipFilter with only an allow list", () => {
      const [route] = validateRoutes([
        { ...validRoute, ipFilter: { allow: ["192.168.1.1", "10.0.0.0/8"] } },
      ]);
      expect(route.ipFilter?.allow).toEqual(["192.168.1.1", "10.0.0.0/8"]);
    });

    it("accepts ipFilter with only a deny list", () => {
      const [route] = validateRoutes([
        { ...validRoute, ipFilter: { deny: ["10.10.10.10"] } },
      ]);
      expect(route.ipFilter?.deny).toEqual(["10.10.10.10"]);
    });

    it("accepts ipFilter with both allow and deny lists", () => {
      const [route] = validateRoutes([
        { ...validRoute, ipFilter: { allow: ["192.168.0.0/16"], deny: ["192.168.1.1"] } },
      ]);
      expect(route.ipFilter?.allow).toEqual(["192.168.0.0/16"]);
      expect(route.ipFilter?.deny).toEqual(["192.168.1.1"]);
    });

    it("omitting ipFilter leaves it undefined", () => {
      const [route] = validateRoutes([validRoute]);
      expect(route.ipFilter).toBeUndefined();
    });

    it("throws when ipFilter has neither allow nor deny", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, ipFilter: {} }])
      ).toThrow("ipFilter must specify at least one of: allow, deny");
    });

    it("throws when an allow entry is not a valid IPv4 or CIDR", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, ipFilter: { allow: ["not-an-ip"] } }])
      ).toThrow();
    });

    it("throws when a deny entry is not a valid IPv4 or CIDR", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, ipFilter: { deny: ["not-an-ip-address"] } }])
      ).toThrow();
    });

    it("throws when allow list is empty", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, ipFilter: { allow: [] } }])
      ).toThrow("IP list must contain at least one entry");
    });

    it("throws when deny list is empty", () => {
      expect(() =>
        validateRoutes([{ ...validRoute, ipFilter: { deny: [] } }])
      ).toThrow("IP list must contain at least one entry");
    });
  });
});
