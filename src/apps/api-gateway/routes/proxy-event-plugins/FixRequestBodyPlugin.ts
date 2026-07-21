import type { ClientRequest, IncomingMessage } from "node:http";
import { fixRequestBody } from "http-proxy-middleware";
import type { ProxyEventPlugin } from "./ProxyEventPlugin";

/**
 * The body-parser middleware adds a parsed `body` property to the incoming
 * request before proxy middleware sees it. `fixRequestBody` needs this type
 * to re-serialise the body onto the outgoing proxy request.
 *
 * This mirrors the library's internal `BodyParserLikeRequest` type, expressed
 * here with a concrete value type instead of `any` for readability.
 */
type RequestWithParsedBody = IncomingMessage & { body?: Record<string, unknown> };

/**
 * Ensures that the parsed request body (populated by body-parser) is
 * re-serialised onto the outgoing proxy request after http-proxy-middleware
 * has already forwarded the raw stream.
 *
 * Must be the first plugin in the chain so subsequent plugins can safely
 * read or modify headers on an already-written request.
 */
export class FixRequestBodyPlugin implements ProxyEventPlugin {
  onProxyReq(proxyReq: ClientRequest, req: IncomingMessage): void {
    fixRequestBody(proxyReq, req as RequestWithParsedBody);
  }
}
