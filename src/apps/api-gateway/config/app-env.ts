import { type GatewayConfig, gatewayConfig } from "./gateway/config";
import { type CorsConfig, corsConfig } from "./cors/config";
import { type RoutesConfig, routesConfig } from "./routes/config";
import { type EnvConfig, envConfig } from "./env/config";

export type AppEnv = {
  env: EnvConfig;
  gateway: GatewayConfig;
  cors: CorsConfig;
  routes: RoutesConfig;
};

export const appEnv: AppEnv = {
  env: envConfig,
  gateway: gatewayConfig,
  cors: corsConfig,
  routes: routesConfig,
} as const satisfies AppEnv;
