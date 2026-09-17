import { GatewaysSchema } from "@gateway/routes/validators/gateway.schema";
import type { ConfigurationWarning, GatewayRoute } from "./configuration.types";

export type ValidationIssue = {
  path: Array<string | number>;
  message: string;
};

export type ValidationResult =
  | { success: true; routes: GatewayRoute[]; warnings: ConfigurationWarning[] }
  | { success: false; issues: ValidationIssue[] };

export function validateConfiguration(input: unknown): ValidationResult {
  const parsed = GatewaysSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map((part) => part as string | number),
        message: issue.message,
      })),
    };
  }

  return {
    success: true,
    routes: parsed.data,
    warnings: findPrefixWarnings(parsed.data),
  };
}

function findPrefixWarnings(routes: GatewayRoute[]): ConfigurationWarning[] {
  const warnings: ConfigurationWarning[] = [];

  for (let left = 0; left < routes.length; left += 1) {
    for (let right = left + 1; right < routes.length; right += 1) {
      const first = routes[left].baseURL;
      const second = routes[right].baseURL;
      const exact = first === second;
      const nested = first.startsWith(`${second}/`) || second.startsWith(`${first}/`);

      if (exact || nested) {
        warnings.push({
          path: [right, "baseURL"],
          message: exact
            ? `Duplicate route prefix: ${second}`
            : `Route prefixes ${first} and ${second} overlap; route order can affect matching.`,
        });
      }
    }
  }

  return warnings;
}
