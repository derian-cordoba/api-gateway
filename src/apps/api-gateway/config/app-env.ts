import { type GatewayConfig, gatewayConfig } from "./gateway/config";

export type AppEnv = {
  gateway: GatewayConfig;
};

export const appEnv: AppEnv = {
  gateway: gatewayConfig,
} as const satisfies AppEnv;
