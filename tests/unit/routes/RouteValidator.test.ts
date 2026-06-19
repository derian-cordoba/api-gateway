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
});
