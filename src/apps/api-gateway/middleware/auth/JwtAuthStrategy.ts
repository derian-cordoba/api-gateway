import type { Request, Response, NextFunction } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import jwt from "jsonwebtoken";
import type { JwtAuth } from "../../types/auth";
import type { AuthStrategy } from "./AuthStrategy";
import { appEnv } from "../../config/app-env";

type ResolvedKey = {
  key: string;
  isAsymmetric: boolean;
};

export class JwtAuthStrategy implements AuthStrategy {
  constructor(private readonly auth: JwtAuth) {}

  handle(req: Request, res: Response, next: NextFunction): void {
    const token = this.extractToken(req);
    if (!token) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: "Missing or malformed Authorization header" });
      return;
    }

    const resolved = this.resolveKey();
    if (!resolved) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: "JWT key not configured" });
      return;
    }

    try {
      jwt.verify(token, resolved.key, { algorithms: this.resolveAlgorithms(resolved.isAsymmetric) });
      next();
    } catch {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: "Invalid or expired token" });
    }
  }

  private extractToken(req: Request): string | null {
    const { authorization } = req.headers;
    if (!authorization?.startsWith("Bearer ")) return null;
    return authorization.slice(7);
  }

  private resolveKey(): ResolvedKey | null {
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
