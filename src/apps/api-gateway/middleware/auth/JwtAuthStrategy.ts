import type { Request, Response, NextFunction } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import jwt from "jsonwebtoken";
import type { JwtAuth } from "../../types/auth";
import type { AuthStrategy } from "./AuthStrategy";
import { appEnv } from "../../config/app-env";
import { ErrorResponseFactory } from "../ErrorResponseFactory";
import { JwksKeyStore } from "./JwksKeyStore";

type ResolvedKey = {
  key: string;
  isAsymmetric: boolean;
};

export class JwtAuthStrategy implements AuthStrategy {
  private readonly jwksKeyStore: JwksKeyStore | null;

  constructor(private readonly auth: JwtAuth) {
    this.jwksKeyStore = this.auth.jwksUri !== undefined ? new JwksKeyStore(this.auth.jwksUri) : null;
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    if (this.jwksKeyStore !== null) {
      void this.doHandle(req, res, next);
    } else {
      this.handleSync(req, res, next);
    }
  }

  private async doHandle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = this.extractToken(req);
    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.unauthorized("Missing or malformed Authorization header"));
      return;
    }

    const resolved = await this.resolveKey(token);
    if (!resolved) {
      res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.unauthorized("JWT key not configured"));
      return;
    }

    try {
      jwt.verify(token, resolved.key, { algorithms: this.resolveAlgorithms(resolved.isAsymmetric) });
      this.forwardVerifiedClaims(req, token);
      next();
    } catch {
      res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.unauthorized("Invalid or expired token"));
    }
  }

  /**
   * Synchronous fast path for static-key configurations (secret or publicKey).
   * Used when `jwksKeyStore` is null so that existing tests and non-JWKS
   * deployments remain fully synchronous with no micro-task overhead.
   */
  private handleSync(req: Request, res: Response, next: NextFunction): void {
    const token = this.extractToken(req);
    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.unauthorized("Missing or malformed Authorization header"));
      return;
    }

    const publicKey = this.auth.publicKey ?? appEnv.auth.jwtPublicKey;
    const secret = this.auth.secret ?? appEnv.auth.jwtSecret;

    const resolved: ResolvedKey | null = publicKey
      ? { key: publicKey, isAsymmetric: true }
      : secret
        ? { key: secret, isAsymmetric: false }
        : null;

    if (!resolved) {
      res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.unauthorized("JWT key not configured"));
      return;
    }

    try {
      jwt.verify(token, resolved.key, { algorithms: this.resolveAlgorithms(resolved.isAsymmetric) });
      this.forwardVerifiedClaims(req, token);
      next();
    } catch {
      res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.unauthorized("Invalid or expired token"));
    }
  }

  private forwardVerifiedClaims(req: Request, token: string): void {
    const forwardClaims = this.auth.forwardClaims;
    if (!forwardClaims || Object.keys(forwardClaims).length === 0) return;

    // Decode without verification — the token was already verified above.
    const payload = jwt.decode(token) as Record<string, unknown> | null;
    if (!payload) return;

    for (const [claimName, headerName] of Object.entries(forwardClaims)) {
      const claimValue = payload[claimName];
      if (claimValue !== undefined && claimValue !== null) {
        req.headers[headerName.toLowerCase()] = String(claimValue);
      }
    }
  }

  private extractToken(req: Request): string | null {
    const { authorization } = req.headers;
    if (!authorization?.startsWith("Bearer ")) return null;
    return authorization.slice(7);
  }

  private async resolveKey(token: string): Promise<ResolvedKey | null> {
    if (this.jwksKeyStore !== null) {
      const decoded = jwt.decode(token, { complete: true });
      const kid = decoded?.header?.kid;
      if (!kid) {
        throw new Error("JWKS-based verification requires a `kid` in the token header");
      }
      const pem = await this.jwksKeyStore.getPublicKey(kid);
      return { key: pem, isAsymmetric: true };
    }

    const publicKey = this.auth.publicKey ?? appEnv.auth.jwtPublicKey;
    if (publicKey) return { key: publicKey, isAsymmetric: true };

    const secret = this.auth.secret ?? appEnv.auth.jwtSecret;
    if (secret) return { key: secret, isAsymmetric: false };

    return null;
  }

  private resolveAlgorithms(isAsymmetric: boolean): jwt.Algorithm[] {
    if (this.auth.algorithms) return this.auth.algorithms as jwt.Algorithm[];
    return isAsymmetric ? ["RS256"] : ["HS256"];
  }
}
