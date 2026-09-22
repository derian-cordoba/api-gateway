import type { RequestHandler, Request, Response, NextFunction } from "express";
import type { Auth } from "../types/auth";
import type { AuthStrategy } from "./auth/AuthStrategy";
import { JwtAuthStrategy } from "./auth/JwtAuthStrategy";
import { ApiKeyAuthStrategy } from "./auth/ApiKeyAuthStrategy";
import { BasicAuthStrategy } from "./auth/BasicAuthStrategy";
import { OAuth2AuthStrategy } from "./auth/OAuth2AuthStrategy";
import { assertNever } from "../../../shared/assertions/assertNever";

/**
 * Resolves the correct `AuthStrategy` for the given `auth` config using
 * TypeScript's discriminated-union narrowing via an exhaustive switch.
 * No type casts required — the compiler guarantees type safety at each branch.
 */
function resolveStrategy(auth: Auth): AuthStrategy {
  switch (auth.strategy) {
    case "jwt":
      return new JwtAuthStrategy(auth);
    case "apiKey":
      return new ApiKeyAuthStrategy(auth);
    case "basicAuth":
      return new BasicAuthStrategy(auth);
    case "oauth2":
      return new OAuth2AuthStrategy(auth);
    default:
      return assertNever(auth, "authentication strategy");
  }
}

export function createAuthMiddleware(auth: Auth): RequestHandler {
  if (!auth.enabled) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const strategy = resolveStrategy(auth);
  return (req, res, next) => strategy.handle(req, res, next);
}
