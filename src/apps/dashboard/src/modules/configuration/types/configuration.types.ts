import type { RouteSourceSummary } from "../../../../../../modules/route-sources/types";
import type { z } from "zod";
import type { GatewaySchema } from "@gateway/routes/validators/gateway.schema";

// Derive the dashboard contract from the gateway's authoritative JSON schema.
// This is a type-only dependency, so no gateway code is shipped to the browser.
export type GatewayRoute = z.infer<typeof GatewaySchema>;
export type HttpMethod = NonNullable<GatewayRoute["proxy"]["method"]>;
export type AuthRateLimit = NonNullable<NonNullable<GatewayRoute["auth"]>["authRateLimit"]>;
export type HeaderTransform = NonNullable<NonNullable<GatewayRoute["headers"]>["request"]>;

export type ConfigurationWarning = { path: Array<string | number>; message: string };

export type StoredConfiguration = {
  sourceId?: string;
  source?: RouteSourceSummary;
  routes: GatewayRoute[];
  revision: string;
  updatedAt: string | null;
  filePath?: string;
  warnings: ConfigurationWarning[];
};

export type ValidationIssue = { path: Array<string | number>; message: string };
