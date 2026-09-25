import { EnvParser } from "../EnvParser";

const { MANAGEMENT_ENABLED, MANAGEMENT_TOKEN, MANAGEMENT_PREFIX } = process.env;

export type ManagementConfig = {
  enabled: boolean;
  token: string | undefined;
  prefix: string;
};

const enabled = EnvParser.boolean(MANAGEMENT_ENABLED, false);
const token = MANAGEMENT_TOKEN?.trim() || undefined;

if (enabled && !token) {
  throw new Error("MANAGEMENT_TOKEN is required when MANAGEMENT_ENABLED=true");
}

export const managementConfig = {
  enabled,
  token,
  prefix: MANAGEMENT_PREFIX?.trim() || "/management",
} as const satisfies ManagementConfig;
