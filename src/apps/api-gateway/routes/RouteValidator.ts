import type { Gateway } from "../types/gateway";
import type { JsonObject } from "./route-sources/RouteSource";
import { GatewaysSchema } from "./validators/gateway.schema";

export function validateRoutes(routes: JsonObject[]): Gateway[] {
  const result = GatewaysSchema.safeParse(routes);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  [${issue.path.join(".")}] ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid route configuration:\n${formatted}`);
  }

  return result.data as Gateway[];
}
