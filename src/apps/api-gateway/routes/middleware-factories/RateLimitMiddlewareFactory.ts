import rateLimit from "express-rate-limit";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { MiddlewareFactory } from "./MiddlewareFactory";

export class RateLimitMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    if (!route.rateLimit) return null;
    const config = route.rateLimit;

    return rateLimit({
      windowMs: config.windowMs,
      limit: config.max,
      statusCode: config.statusCode ?? HttpStatus.TOO_MANY_REQUESTS,
      message: config.message ?? "Too many requests",
      standardHeaders: true,
      legacyHeaders: false,
    });
  }
}
