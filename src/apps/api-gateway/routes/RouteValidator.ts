import type { Gateway } from "../types/gateway";
import type { JsonObject } from "./route-sources/RouteSource";
import { GatewaysSchema } from "./validators/gateway.schema";
import { logger } from "../logger";
import { findRoutePrefixConflicts } from "../../../shared/routes/findRoutePrefixConflicts";

export function validateRoutes(routes: JsonObject[]): Gateway[] {
  const result = GatewaysSchema.safeParse(routes);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  [${issue.path.join(".")}] ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid route configuration:\n${formatted}`);
  }

  const validatedRoutes = result.data as Gateway[];
  const duplicate = findRoutePrefixConflicts(validatedRoutes)
    .find((conflict) => conflict.exact);

  if (duplicate) {
    throw new Error(`Duplicate route prefix: ${duplicate.secondPrefix} (routes ${duplicate.firstIndex} and ${duplicate.secondIndex})`);
  }
  detectPrefixConflicts(validatedRoutes);
  return validatedRoutes;
}

function detectPrefixConflicts(routes: readonly Gateway[]): void {
  for (const conflict of findRoutePrefixConflicts(routes)) {
    if (conflict.exact) {
      continue;
    }

    const [shorterPrefix, longerPrefix] = conflict.firstPrefix.length <= conflict.secondPrefix.length
      ? [conflict.firstPrefix, conflict.secondPrefix]
      : [conflict.secondPrefix, conflict.firstPrefix];
    logger.info(
      { shorterPrefix, longerPrefix },
      "Nested route prefixes: the longer prefix takes precedence",
    );
  }
}
