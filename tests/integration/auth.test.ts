import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import { generateKeyPairSync } from "node:crypto";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import { Server } from "../../src/apps/api-gateway/Server";

const UPSTREAM_PORT = 19_002;
const HMAC_SECRET = "integration-test-secret";

function startUpstream(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const upstream = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ proxied: true }));
    });
    upstream.listen(UPSTREAM_PORT, () => resolve(upstream));
  });
}

describe("Auth middleware — integration", () => {
  let upstream: HttpServer;
  let request: ReturnType<typeof supertest>;
  let rsaPublicKey: string;
  let rsaPrivateKey: string;
  let wrongRsaPrivateKey: string;

  beforeAll(async () => {
    upstream = await startUpstream();

    // Generate a throwaway RSA key pair for RS256 tests
    const kp = generateKeyPairSync("rsa", { modulusLength: 2048 });
    rsaPublicKey = kp.publicKey.export({ type: "spki", format: "pem" }) as string;
    rsaPrivateKey = kp.privateKey.export({ type: "pkcs8", format: "pem" }) as string;

    const wrongKp = generateKeyPairSync("rsa", { modulusLength: 2048 });
    wrongRsaPrivateKey = wrongKp.privateKey.export({ type: "pkcs8", format: "pem" }) as string;

    const target = `http://localhost:${UPSTREAM_PORT}`;

    process.env.ROUTES = JSON.stringify([
      {
        baseURL: "/protected-jwt-hmac",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/protected-jwt-hmac": "" } },
        auth: { enabled: true, strategy: "jwt", secret: HMAC_SECRET },
      },
      {
        baseURL: "/protected-jwt-cert",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/protected-jwt-cert": "" } },
        auth: { enabled: true, strategy: "jwt", publicKey: rsaPublicKey },
      },
      {
        baseURL: "/protected-apikey",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/protected-apikey": "" } },
        auth: { enabled: true, strategy: "apiKey", keys: ["valid-key-abc"] },
      },
      {
        baseURL: "/unprotected",
        proxy: { target, changeOrigin: true, pathRewrite: { "^/unprotected": "" } },
        auth: { enabled: false, strategy: "jwt" },
      },
    ]);

    const gateway = new Server();
    await gateway.init();
    request = supertest(gateway.getApp());
  });

  afterAll(async () => {
    delete process.env.ROUTES;
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  });

  // MARK: JWT HMAC (HS256)

  describe("HMAC JWT route (/protected-jwt-hmac)", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await request.get("/protected-jwt-hmac");
      expect(res.status).toBe(401);
    });

    it("proxies the request with a valid HS256 token", async () => {
      const token = jwt.sign({ sub: "user-1" }, HMAC_SECRET, { algorithm: "HS256" });
      const res = await request
        .get("/protected-jwt-hmac")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.proxied).toBe(true);
    });

    it("returns 401 with a tampered token", async () => {
      const token = jwt.sign({ sub: "user-1" }, HMAC_SECRET, { algorithm: "HS256" });
      const res = await request
        .get("/protected-jwt-hmac")
        .set("Authorization", `Bearer ${token}tampered`);
      expect(res.status).toBe(401);
    });
  });

  // MARK: JWT RSA (RS256)

  describe("RSA JWT route (/protected-jwt-cert)", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await request.get("/protected-jwt-cert");
      expect(res.status).toBe(401);
    });

    it("proxies the request with a valid RS256 token", async () => {
      const token = jwt.sign({ sub: "user-1" }, rsaPrivateKey, { algorithm: "RS256" });
      const res = await request
        .get("/protected-jwt-cert")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.proxied).toBe(true);
    });

    it("returns 401 when token is signed with a different private key", async () => {
      const token = jwt.sign({ sub: "user-1" }, wrongRsaPrivateKey, { algorithm: "RS256" });
      const res = await request
        .get("/protected-jwt-cert")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });

  // MARK: API Key

  describe("API Key route (/protected-apikey)", () => {
    it("returns 401 when x-api-key header is absent", async () => {
      const res = await request.get("/protected-apikey");
      expect(res.status).toBe(401);
    });

    it("proxies the request with a valid API key", async () => {
      const res = await request
        .get("/protected-apikey")
        .set("x-api-key", "valid-key-abc");
      expect(res.status).toBe(200);
      expect(res.body.proxied).toBe(true);
    });

    it("returns 401 with an invalid API key", async () => {
      const res = await request
        .get("/protected-apikey")
        .set("x-api-key", "wrong-key");
      expect(res.status).toBe(401);
    });
  });

  // MARK: Passthrough (enabled: false)

  describe("Unprotected route with auth disabled (/unprotected)", () => {
    it("proxies without any token", async () => {
      const res = await request.get("/unprotected");
      expect(res.status).toBe(200);
      expect(res.body.proxied).toBe(true);
    });
  });
});
