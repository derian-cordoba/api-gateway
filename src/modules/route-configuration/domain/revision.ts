import { createHash, randomBytes } from "node:crypto";
import type { GatewayRoute, RouteRevision } from "./types";

export function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createRevision(
  routes: GatewayRoute[],
  restoredFrom?: string,
): RouteRevision {
  return {
    revision: randomBytes(16).toString("hex"),
    version: 0,
    routes,
    updatedAt: new Date().toISOString(),
    checksum: checksum(routes),
    ...(restoredFrom && { restoredFrom }),
  };
}
