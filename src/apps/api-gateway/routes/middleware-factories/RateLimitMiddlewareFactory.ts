import rateLimit, { ipKeyGenerator, type Store } from "express-rate-limit";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import { RequestKeyExtractorFactory } from "../../middleware/key-extractors/RequestKeyExtractorFactory";
import { IpKeyExtractor } from "../../middleware/key-extractors/IpKeyExtractor";
import { omitUndefined } from "../../../../shared/objects/omitUndefined";
import type { RateLimitStore } from "../../middleware/rate-limit/RateLimitStore";

const DEFAULT_EXTRACTOR = new IpKeyExtractor();

export class RateLimitMiddlewareFactory implements MiddlewareFactory {
  constructor(
    private readonly storeFactory?: (route: Gateway) => RateLimitStore,
  ) { }

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
      ...omitUndefined({
        skip: config.skip,
        store: (this.storeFactory?.(route) ?? config.store) as Store | undefined,
      }),
      keyGenerator: (req) =>
        extractor.extract(req) ??
        ipKeyGenerator(req.ip ?? "unknown") ??
        "unknown",
    });
  }
}
