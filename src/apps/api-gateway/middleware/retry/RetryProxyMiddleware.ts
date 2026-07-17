import type { RequestHandler, Request, Response } from "express";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { RetryConfig } from "../../types/retry";
import type { CircuitBreaker } from "../circuit-breaker/CircuitBreaker";
import type { LoadBalancer } from "../load-balancer/LoadBalancer";
import { logger } from "../../logger";

function computeDelay(config: RetryConfig, attemptIndex: number): number {
  if (config.backoff === "exponential") {
    return config.delay * Math.pow(2, attemptIndex);
  }
  return config.delay;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * Re-serialize `req.body` back to a Buffer so that the upstream HTTP request
 * gets the correct body bytes. `express.json()` / `express.urlencoded()` have
 * already consumed the stream by the time middleware runs.
 */
function serializeBody(req: Request): Buffer {
  if (req.body === undefined || req.body === null) return Buffer.alloc(0);

  const ct = (req.headers["content-type"] ?? "").toLowerCase();
  if (ct.includes("application/x-www-form-urlencoded")) {
    return Buffer.from(new URLSearchParams(req.body as Record<string, string>).toString(), "utf-8");
  }
  if (typeof req.body === "string") return Buffer.from(req.body, "utf-8");
  return Buffer.from(JSON.stringify(req.body), "utf-8");
}

function isRetryable(statusCode: number): boolean {
  return statusCode >= 500;
}

function makeUpstreamRequest(
  targetBase: string,
  req: Request,
  body: Buffer,
  pathRewrite: Record<string, string> | undefined,
): Promise<{ res: IncomingMessage; body: Buffer }> {
  return new Promise((resolve, reject) => {
    let pathname = req.url ?? "/";

    if (pathRewrite) {
      for (const [pattern, replacement] of Object.entries(pathRewrite)) {
        pathname = pathname.replace(new RegExp(pattern), replacement);
      }
    }

    const parsed = new URL(pathname, targetBase);
    const useHttps = parsed.protocol === "https:";
    const transport = useHttps ? httpsRequest : httpRequest;

    const upstreamReq = transport(
      {
        hostname: parsed.hostname,
        port: parsed.port || (useHttps ? 443 : 80),
        path: parsed.pathname + (parsed.search ?? ""),
        method: req.method,
        headers: {
          ...req.headers,
          host: parsed.host,
          "content-length": body.length,
        },
      },
      (upstreamRes) => {
        const chunks: Buffer[] = [];
        upstreamRes.on("data", (chunk: Buffer) => chunks.push(chunk));
        upstreamRes.on("end", () => resolve({ res: upstreamRes, body: Buffer.concat(chunks) }));
        upstreamRes.on("error", reject);
      },
    );

    upstreamReq.on("error", reject);
    if (body.length > 0) upstreamReq.write(body);
    upstreamReq.end();
  });
}

export function createRetryProxyMiddleware(
  config: RetryConfig,
  proxyTarget: string | undefined,
  pathRewrite: Record<string, string> | undefined,
  balancer: LoadBalancer | null,
  breaker: CircuitBreaker | null,
): RequestHandler {
  return async (req: Request, res: Response) => {
    const body = serializeBody(req);
    const abort = new AbortController();

    // Stop retrying if the client disconnects or timeout fires 504
    res.on("close", () => abort.abort());

    let lastStatus = 0;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= config.attempts; attempt++) {
      if (abort.signal.aborted) break;

      const target = balancer ? balancer.selectTarget(req) : proxyTarget!;

      try {
        const upstream = await makeUpstreamRequest(target, req, body, pathRewrite);
        const { res: upstreamRes, body: upstreamBody } = upstream;
        const status = upstreamRes.statusCode ?? 502;

        if (isRetryable(status) && attempt < config.attempts) {
          breaker?.recordFailure();
          lastStatus = status;
          lastErr = null;
          logger.warn(
            { baseURL: req.baseUrl, attempt, status },
            "Upstream returned 5xx — retrying",
          );
          const delay = computeDelay(config, attempt);
          await sleep(delay, abort.signal);
          if (balancer) balancer.onConnectionClosed(req);
          continue;
        }

        // Final attempt or success — pipe response to client
        if (res.headersSent) {
          if (balancer) balancer.onConnectionClosed(req);
          return;
        }

        if (status < 500) {
          breaker?.recordSuccess();
        } else {
          breaker?.recordFailure();
        }

        // Forward all upstream headers except hop-by-hop
        const hopByHop = new Set([
          "connection",
          "keep-alive",
          "proxy-authenticate",
          "proxy-authorization",
          "te",
          "trailers",
          "transfer-encoding",
          "upgrade",
        ]);
        for (const [key, value] of Object.entries(upstreamRes.headers)) {
          if (!hopByHop.has(key.toLowerCase()) && value !== undefined) {
            res.setHeader(key, value as string | string[]);
          }
        }

        res.status(status).end(upstreamBody);
        if (balancer) balancer.onConnectionClosed(req);
        return;
      } catch (err) {
        breaker?.recordFailure();
        lastErr = err as Error;
        lastStatus = 0;

        if (attempt < config.attempts && !abort.signal.aborted) {
          logger.warn(
            { baseURL: req.baseUrl, attempt, err: lastErr.message },
            "Upstream network error — retrying",
          );
          const delay = computeDelay(config, attempt);
          try {
            await sleep(delay, abort.signal);
          } catch {
            break;
          }
        }
      }
    }

    if (res.headersSent) return;

    const status = lastStatus >= 500 ? lastStatus : HttpStatus.BAD_GATEWAY;
    res.status(status).json({
      error: lastErr ? "Bad Gateway" : "Bad Gateway",
      message: lastErr?.message ?? `Upstream returned ${lastStatus}`,
    });
  };
}
