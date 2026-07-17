import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { BasicAuth } from "../../types/auth";
import type { AuthStrategy } from "./AuthStrategy";

/**
 * Hash both strings with SHA-256 before comparing so timingSafeEqual always
 * receives equal-length buffers — avoids early exit on length mismatch.
 */
function safeEquals(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export class BasicAuthStrategy implements AuthStrategy {
  private readonly realm: string;

  constructor(private readonly auth: BasicAuth) {
    this.realm = auth.realm ?? "API Gateway";
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    const { authorization } = req.headers;

    if (!authorization?.startsWith("Basic ")) {
      this.reject(res);
      return;
    }

    const encoded = authorization.slice(6);
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const colonIndex = decoded.indexOf(":");

    if (colonIndex === -1) {
      this.reject(res);
      return;
    }

    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    const matched = this.auth.credentials.some(
      (cred) => safeEquals(cred.username, username) && safeEquals(cred.password, password),
    );

    if (!matched) {
      this.reject(res);
      return;
    }

    next();
  }

  private reject(res: Response): void {
    res.set("WWW-Authenticate", `Basic realm="${this.realm}"`);
    res.status(HttpStatus.UNAUTHORIZED).json({ error: "Invalid credentials" });
  }
}
