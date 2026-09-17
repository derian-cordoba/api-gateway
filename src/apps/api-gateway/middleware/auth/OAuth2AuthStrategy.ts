import type { Request, Response, NextFunction } from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { OAuth2Auth } from "../../types/auth";
import type { AuthStrategy } from "./AuthStrategy";
import type { CacheStore } from "../cache/CacheStore";
import { MemoryCacheStore } from "../cache/MemoryCacheStore";
import { ErrorResponseFactory } from "../ErrorResponseFactory";

export type OAuth2IntrospectionResponse = {
  active: boolean;
};

export type IntrospectionCacheEntry = {
  active: boolean;
  expiresAt: number;
};

export class OAuth2AuthStrategy implements AuthStrategy {
  private readonly cache: CacheStore<IntrospectionCacheEntry>;

  constructor(
    private readonly auth: OAuth2Auth,
    cache: CacheStore<IntrospectionCacheEntry> = new MemoryCacheStore(),
  ) {
    this.cache = cache;
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    void this.doHandle(req, res, next);
  }

  private async doHandle(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = this.extractToken(req);
    if (!token) {
      res
        .status(HttpStatus.UNAUTHORIZED)
        .json(ErrorResponseFactory.unauthorized("Missing or malformed Authorization header"));
      return;
    }

    try {
      const active = await this.resolveActive(token);
      if (!active) {
        res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.unauthorized("Token is inactive or invalid"));
        return;
      }
      next();
    } catch {
      res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.unauthorized("Token introspection failed"));
    }
  }

  private extractToken(req: Request): string | null {
    const { authorization } = req.headers;
    if (!authorization?.startsWith("Bearer ")) return null;
    return authorization.slice(7);
  }

  /**
   * Returns the cached `active` value if present and not expired, otherwise
   * calls the introspection endpoint and caches the result (active-only).
   */
  private async resolveActive(token: string): Promise<boolean> {
    const ttl = this.auth.introspectionCacheTtlMs;

    if (ttl !== undefined) {
      const hit = this.cache.get(token);
      if (hit !== null) return hit.active;
    }

    const active = await this.introspect(token);

    // Only cache positive results — never cache inactive/invalid tokens so
    // revocation takes effect within the next request.
    if (ttl !== undefined && active) {
      this.cache.set(token, { active, expiresAt: Date.now() + ttl });
    }

    return active;
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

    const data = (await response.json()) as OAuth2IntrospectionResponse;
    return data.active === true;
  }
}
