import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";

// MARK: Mock appEnv
// vi.hoisted runs before any import, making mockAuthConfig available inside
// the vi.mock factory (which is also hoisted ahead of imports by Vitest).
const mockAuthConfig = vi.hoisted(() => ({
  jwtSecret: undefined as string | undefined,
  jwtPublicKey: undefined as string | undefined,
}));

vi.mock("../../../src/apps/api-gateway/config/app-env", () => ({
  appEnv: { auth: mockAuthConfig },
}));

import { createAuthMiddleware } from "../../../src/apps/api-gateway/middleware/authMiddleware";
import type { Auth } from "../../../src/apps/api-gateway/types/auth";

// MARK: helpers

const HMAC_SECRET = "test-secret-key";

function makeReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { headers: {}, ...overrides };
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json: vi.fn(), _json: json };
}

function makeNext() {
  return vi.fn();
}

function runMiddleware(
  auth: Auth,
  req: Record<string, unknown>,
  res: ReturnType<typeof makeRes>,
  next: ReturnType<typeof makeNext>
) {
  const middleware = createAuthMiddleware(auth);
  middleware(req as never, res as never, next);
}

afterEach(() => {
  mockAuthConfig.jwtSecret = undefined;
  mockAuthConfig.jwtPublicKey = undefined;
});

// MARK: disabled auth

describe("disabled auth", () => {
  it("calls next() immediately regardless of strategy", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware({ enabled: false, strategy: "jwt" }, makeReq(), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// MARK: JWT — HMAC (HS256)

describe("JWT strategy — HMAC", () => {
  let validToken: string;

  beforeEach(() => {
    validToken = jwt.sign({ sub: "user-1" }, HMAC_SECRET, { algorithm: "HS256" });
  });

  it("calls next() with a valid token and secret in config", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", secret: HMAC_SECRET },
      makeReq({ headers: { authorization: `Bearer ${validToken}` } }),
      res,
      next
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() with a valid token and secret from appEnv.auth.jwtSecret", () => {
    mockAuthConfig.jwtSecret = HMAC_SECRET;
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt" },
      makeReq({ headers: { authorization: `Bearer ${validToken}` } }),
      res,
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when Authorization header is absent", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", secret: HMAC_SECRET },
      makeReq({ headers: {} }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is malformed (no Bearer prefix)", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", secret: HMAC_SECRET },
      makeReq({ headers: { authorization: validToken } }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is tampered", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", secret: HMAC_SECRET },
      makeReq({ headers: { authorization: `Bearer ${validToken}tampered` } }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is expired", () => {
    const expired = jwt.sign({ sub: "user-1" }, HMAC_SECRET, {
      algorithm: "HS256",
      expiresIn: -1,
    });
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", secret: HMAC_SECRET },
      makeReq({ headers: { authorization: `Bearer ${expired}` } }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when no key is configured at all", () => {
    const next = makeNext();
    const res = makeRes();
    // mockAuthConfig defaults to undefined after each test via afterEach
    runMiddleware(
      { enabled: true, strategy: "jwt" },
      makeReq({ headers: { authorization: `Bearer ${validToken}` } }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token algorithm does not match allowlist", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", secret: HMAC_SECRET, algorithms: ["HS384"] },
      makeReq({ headers: { authorization: `Bearer ${validToken}` } }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// MARK: JWT — asymmetric (RS256)

describe("JWT strategy — RSA public key (RS256)", () => {
  let privateKey: string;
  let publicKey: string;
  let wrongPrivateKey: string;
  let validToken: string;

  beforeEach(() => {
    const kp = generateKeyPairSync("rsa", { modulusLength: 2048 });
    privateKey = kp.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    publicKey = kp.publicKey.export({ type: "spki", format: "pem" }) as string;

    const wrong = generateKeyPairSync("rsa", { modulusLength: 2048 });
    wrongPrivateKey = wrong.privateKey.export({ type: "pkcs8", format: "pem" }) as string;

    validToken = jwt.sign({ sub: "user-1" }, privateKey, { algorithm: "RS256" });
  });

  it("calls next() with a valid token and publicKey in config", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", publicKey },
      makeReq({ headers: { authorization: `Bearer ${validToken}` } }),
      res,
      next
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() with a valid token and publicKey from appEnv.auth.jwtPublicKey", () => {
    mockAuthConfig.jwtPublicKey = publicKey;
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt" },
      makeReq({ headers: { authorization: `Bearer ${validToken}` } }),
      res,
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("publicKey takes precedence over secret when both are provided", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", publicKey, secret: "wrong-secret" },
      makeReq({ headers: { authorization: `Bearer ${validToken}` } }),
      res,
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when token was signed with a different private key", () => {
    const wrongToken = jwt.sign({ sub: "user-1" }, wrongPrivateKey, { algorithm: "RS256" });
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "jwt", publicKey },
      makeReq({ headers: { authorization: `Bearer ${wrongToken}` } }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// MARK: API Key

describe("API Key strategy", () => {
  const VALID_KEY = "secret-api-key-123";

  it("calls next() with a valid key in the default header", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "apiKey", keys: [VALID_KEY] },
      makeReq({ headers: { "x-api-key": VALID_KEY } }),
      res,
      next
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() with a valid key in a custom header", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "apiKey", header: "x-gateway-key", keys: [VALID_KEY] },
      makeReq({ headers: { "x-gateway-key": VALID_KEY } }),
      res,
      next
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when the key header is absent", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "apiKey", keys: [VALID_KEY] },
      makeReq({ headers: {} }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the provided key is not in the allowlist", () => {
    const next = makeNext();
    const res = makeRes();
    runMiddleware(
      { enabled: true, strategy: "apiKey", keys: [VALID_KEY] },
      makeReq({ headers: { "x-api-key": "wrong-key" } }),
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
