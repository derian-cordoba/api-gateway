import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { IncomingHttpHeaders } from "node:http";
import type { Request } from "express";
import type { HeadersConfig } from "../../types/headers";

export interface UpstreamRequest {
  target: string;
  req: Request;
  body: Buffer;
}

export interface UpstreamResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

/**
 * Abstraction over a single upstream HTTP/HTTPS call.
 * Implementations can be swapped in tests without touching retry logic.
 */
export interface UpstreamHttpClient {
  send(request: UpstreamRequest): Promise<UpstreamResponse>;
}

/**
 * Concrete implementation using Node's built-in `http`/`https` modules.
 *
 * Responsibilities:
 *  - Path rewriting
 *  - Request header forwarding + configured set/remove transforms
 *  - Collecting the full upstream response body into a single `Buffer`
 */
export class NodeHttpUpstreamClient implements UpstreamHttpClient {
  constructor(
    private readonly pathRewrite?: Record<string, string>,
    private readonly requestHeadersConfig?: HeadersConfig["request"],
  ) {}

  send({ target, req, body }: UpstreamRequest): Promise<UpstreamResponse> {
    return new Promise((resolve, reject) => {
      const pathname = this.rewritePath(req.url ?? "/");
      const parsed = new URL(pathname, target);
      const useHttps = parsed.protocol === "https:";
      const transport = useHttps ? httpsRequest : httpRequest;

      const outHeaders: Record<string, unknown> = {
        ...req.headers,
        host: parsed.host,
        "content-length": body.length,
      };

      if (this.requestHeadersConfig?.set) {
        for (const [key, val] of Object.entries(this.requestHeadersConfig.set)) {
          outHeaders[key.toLowerCase()] = val;
        }
      }
      if (this.requestHeadersConfig?.remove) {
        for (const key of this.requestHeadersConfig.remove) {
          delete outHeaders[key.toLowerCase()];
        }
      }

      const upstreamReq = transport(
        {
          hostname: parsed.hostname,
          port: parsed.port || (useHttps ? 443 : 80),
          path: parsed.pathname + (parsed.search ?? ""),
          method: req.method,
          headers: outHeaders as Record<string, string | string[] | number>,
        },
        (upstreamRes) => {
          const chunks: Buffer[] = [];
          upstreamRes.on("data", (chunk: Buffer) => chunks.push(chunk));
          upstreamRes.on("end", () => {
            resolve({
              statusCode: upstreamRes.statusCode ?? HttpStatus.BAD_GATEWAY,
              headers: upstreamRes.headers,
              body: Buffer.concat(chunks),
            });
          });
          upstreamRes.on("error", reject);
        },
      );

      upstreamReq.on("error", reject);
      if (body.length > 0) {
        upstreamReq.write(body);
      }
      upstreamReq.end();
    });
  }

  private rewritePath(pathname: string): string {
    if (this.pathRewrite) {
      for (const [pattern, replacement] of Object.entries(this.pathRewrite)) {
        pathname = pathname.replace(new RegExp(pattern), replacement);
      }
    };
    return pathname;
  }
}
