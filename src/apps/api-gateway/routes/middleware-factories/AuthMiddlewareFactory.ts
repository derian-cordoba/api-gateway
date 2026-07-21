import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import { createAuthMiddleware } from "../../middleware/authMiddleware";
import type { MiddlewareFactory } from "./MiddlewareFactory";

export class AuthMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    if (!route.auth) return null;
    return createAuthMiddleware(route.auth) as RequestHandler;
  }
}
