import { GatewaysSchema } from "@gateway/routes/validators/gateway.schema";
import type { ConfigurationWarning, GatewayRoute } from "./configuration.types";
import { findRoutePrefixConflicts } from "@shared/routes/findRoutePrefixConflicts";

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

  const duplicate = findRoutePrefixConflicts(parsed.data).find((conflict) => conflict.exact);

  if (duplicate) {
    return {
      success: false,
      issues: [
        {
          path: [duplicate.secondIndex, "baseURL"],
          message: `Duplicate route prefix: ${duplicate.secondPrefix}`,
        },
      ],
    };
  }

  return {
    success: true,
    routes: parsed.data,
    warnings: findPrefixWarnings(parsed.data),
  };
}

function findPrefixWarnings(routes: GatewayRoute[]): ConfigurationWarning[] {
  return findRoutePrefixConflicts(routes)
    .filter((conflict) => !conflict.exact)
    .map((conflict) => ({
      path: [conflict.secondIndex, "baseURL"],
      message: `Route prefixes ${conflict.firstPrefix} and ${conflict.secondPrefix} overlap; the longer prefix takes precedence.`,
    }));
}
