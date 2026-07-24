import { type GatewayConfig, gatewayConfig } from "./gateway/config";
import { type CorsConfig, corsConfig } from "./cors/config";
import { type RoutesConfig, routesConfig } from "./routes/config";
import { type EnvConfig, envConfig } from "./env/config";
import { type AuthConfig, authConfig } from "./auth/config";
import { type ProxyConfig, proxyConfig } from "./proxy/config";

export type AppEnv = {
  env: EnvConfig;
  gateway: GatewayConfig;
  cors: CorsConfig;
  routes: RoutesConfig;
  auth: AuthConfig;
  proxy: ProxyConfig;
};

export const appEnv: AppEnv = {
  env: envConfig,
  gateway: gatewayConfig,
  cors: corsConfig,
  routes: routesConfig,
  auth: authConfig,
  proxy: proxyConfig,
} as const satisfies AppEnv;
