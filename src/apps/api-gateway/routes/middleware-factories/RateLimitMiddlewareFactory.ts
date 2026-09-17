import rateLimit, { ipKeyGenerator, type Store } from "express-rate-limit";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import { RequestKeyExtractorFactory } from "../../middleware/key-extractors/RequestKeyExtractorFactory";
import { IpKeyExtractor } from "../../middleware/key-extractors/IpKeyExtractor";

const DEFAULT_EXTRACTOR = new IpKeyExtractor();

export class RateLimitMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    if (!route.rateLimit) return null;
    const config = route.rateLimit;

    const extractor = config.keyBy
      ? RequestKeyExtractorFactory.fromSpec(config.keyBy)
      : DEFAULT_EXTRACTOR;

    return rateLimit({
      windowMs: config.windowMs,
      limit: config.max,
      statusCode: config.statusCode ?? HttpStatus.TOO_MANY_REQUESTS,
      message: config.message ?? "Too many requests",
      standardHeaders: true,
      legacyHeaders: false,
      ...(config.skip !== undefined ? { skip: config.skip } : {}),
      keyGenerator: (req) => extractor.extract(req) ?? ipKeyGenerator(req.ip ?? "unknown") ?? "unknown",
      ...(config.store !== undefined ? { store: config.store as Store } : {}),
    });
  }
}
