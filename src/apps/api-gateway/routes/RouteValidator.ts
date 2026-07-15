import type { Gateway } from "../types/gateway";
import { GatewaysSchema } from "./validators/gateway.schema";

export function validateRoutes(data: unknown): Gateway[] {
  const result = GatewaysSchema.safeParse(data);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  [${issue.path.join(".")}] ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid route configuration:\n${formatted}`);
  }

  return result.data as Gateway[];
}
