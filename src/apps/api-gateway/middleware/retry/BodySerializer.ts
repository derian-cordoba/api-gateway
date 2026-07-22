import type { Request } from "express";

/**
 * Serializes `req.body` back to a `Buffer` so that the upstream HTTP request
 * receives the correct bytes. `express.json()` / `express.urlencoded()` have
 * already consumed the stream by the time middleware runs.
 */
export class BodySerializer {
  static serialize(req: Request): Buffer {
    if (req.body === undefined || req.body === null) return Buffer.alloc(0);

    const contentType = (req.headers["content-type"] ?? "").toLowerCase();

    if (contentType.includes("application/x-www-form-urlencoded")) {
      return Buffer.from(
        new URLSearchParams(req.body as Record<string, string>).toString(),
        "utf-8",
      );
    }

    if (typeof req.body === "string") return Buffer.from(req.body, "utf-8");

    return Buffer.from(JSON.stringify(req.body), "utf-8");
  }
}
