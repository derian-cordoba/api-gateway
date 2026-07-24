import type { Gateway } from "../types/gateway";
import type { JsonObject } from "./route-sources/RouteSource";
import { GatewaysSchema } from "./validators/gateway.schema";
import { logger } from "../logger";

export function validateRoutes(routes: JsonObject[]): Gateway[] {
  const result = GatewaysSchema.safeParse(routes);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  [${issue.path.join(".")}] ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid route configuration:\n${formatted}`);
  }

  const validatedRoutes = result.data as Gateway[];
  detectPrefixConflicts(validatedRoutes);
  return validatedRoutes;
}

function detectPrefixConflicts(routes: readonly Gateway[]): void {
  const baseURLs = routes.map((route) => route.baseURL);
  const sortedByLength = [...baseURLs].sort((first, second) => first.length - second.length);

  for (let outerIndex = 0; outerIndex < sortedByLength.length; outerIndex++) {
    const shorterPrefix = sortedByLength[outerIndex];

    for (let innerIndex = outerIndex + 1; innerIndex < sortedByLength.length; innerIndex++) {
      const longerPrefix = sortedByLength[innerIndex];

      const isExactMatch = longerPrefix === shorterPrefix;
      const isPrefixConflict = longerPrefix.startsWith(shorterPrefix + "/");

      if (isExactMatch || isPrefixConflict) {
        logger.warn(
          { shorterPrefix, longerPrefix },
          "Route prefix conflict detected: requests to the longer prefix may be intercepted by the shorter route depending on registration order",
        );
      }
    }
  }
}
