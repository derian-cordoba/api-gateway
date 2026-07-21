import cors from "cors";
import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { MiddlewareFactory } from "./MiddlewareFactory";

export class CorsMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    if (!route.cors) return null;
    return cors(route.cors) as RequestHandler;
  }
}
