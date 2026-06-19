const { GATEWAY_PREFIX, GATEWAY_PORT, PORT } = process.env;

export type GatewayConfig = {
  prefix: string;
  port: number;
};

export const DEFAULT_PORT: number = 3000;

export const gatewayConfig = {
  prefix: GATEWAY_PREFIX || '/',
  port: Number(GATEWAY_PORT || PORT) || DEFAULT_PORT,
} as const satisfies GatewayConfig;
