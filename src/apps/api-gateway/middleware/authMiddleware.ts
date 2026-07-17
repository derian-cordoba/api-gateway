import type { RequestHandler, Request, Response, NextFunction } from "express";
import type { Auth, JwtAuth, ApiKeyAuth, BasicAuth } from "../types/auth";
import type { AuthStrategy } from "./auth/AuthStrategy";
import { JwtAuthStrategy } from "./auth/JwtAuthStrategy";
import { ApiKeyAuthStrategy } from "./auth/ApiKeyAuthStrategy";
import { BasicAuthStrategy } from "./auth/BasicAuthStrategy";

type StrategyFactory = (auth: Auth) => AuthStrategy;

const strategyFactories: Record<Auth["strategy"], StrategyFactory> = {
  jwt: (auth) => new JwtAuthStrategy(auth as JwtAuth),
  apiKey: (auth) => new ApiKeyAuthStrategy(auth as ApiKeyAuth),
  basicAuth: (auth) => new BasicAuthStrategy(auth as BasicAuth),
};

export function createAuthMiddleware(auth: Auth): RequestHandler {
  if (!auth.enabled) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const strategy = strategyFactories[auth.strategy](auth);
  return (req, res, next) => strategy.handle(req, res, next);
}
