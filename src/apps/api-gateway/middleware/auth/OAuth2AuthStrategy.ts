import type { Request, Response, NextFunction } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { OAuth2Auth } from "../../types/auth";
import type { AuthStrategy } from "./AuthStrategy";

export class OAuth2AuthStrategy implements AuthStrategy {
  constructor(private readonly auth: OAuth2Auth) {
    //
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    void this.doHandle(req, res, next);
  }

  private async doHandle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = this.extractToken(req);
    if (!token) {
      res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: "Missing or malformed Authorization header" });
      return;
    }

    try {
      const active = await this.introspect(token);
      if (!active) {
        res.status(HttpStatus.UNAUTHORIZED).json({ error: "Token is inactive or invalid" });
        return;
      }
      next();
    } catch {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: "Token introspection failed" });
    }
  }

  private extractToken(req: Request): string | null {
    const { authorization } = req.headers;
    if (!authorization?.startsWith("Bearer ")) return null;
    return authorization.slice(7);
  }

  private async introspect(token: string): Promise<boolean> {
    const { introspectionUrl, clientId, clientSecret, tokenTypeHint = "access_token" } = this.auth;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const body = new URLSearchParams({ token, token_type_hint: tokenTypeHint });

    const response = await fetch(introspectionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Introspection endpoint returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as { active: boolean };
    return data.active === true;
  }
}
