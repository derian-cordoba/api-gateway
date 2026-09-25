import { EnvParser } from "../EnvParser";

const { GATEWAY_PREFIX, GATEWAY_PORT, PORT, TRUST_PROXY } = process.env;

export type GatewayConfig = {
  prefix: string;
  port: number;
  trustProxy: boolean | number;
};

export const DEFAULT_PORT: number = 3000;

export const gatewayConfig = {
  prefix: GATEWAY_PREFIX || '/',
  port: Number(GATEWAY_PORT || PORT) || DEFAULT_PORT,
  trustProxy: EnvParser.proxyTrust(TRUST_PROXY, false),
} as const satisfies GatewayConfig;
