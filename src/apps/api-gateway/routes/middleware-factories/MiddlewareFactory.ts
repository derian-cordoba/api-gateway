import type { RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";

/**
 * Produces a single Express middleware for one route, or `null` when this
 * feature is not applicable to that route (e.g. no `auth` config present).
 *
 * `null` is preferred over a no-op `next()` handler so that the registrar
 * can skip `router.use()` entirely — one less function call per request.
 */
export interface MiddlewareFactory {
  create(route: Gateway): RequestHandler | null;
}
