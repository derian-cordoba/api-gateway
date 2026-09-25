import { type GatewayConfig, gatewayConfig } from "./gateway/config";
import { type CorsConfig, corsConfig } from "./cors/config";
import { type RoutesConfig, routesConfig } from "./routes/config";
import { type EnvConfig, envConfig } from "./env/config";
import { type AuthConfig, authConfig } from "./auth/config";
import { type ProxyConfig, proxyConfig } from "./proxy/config";
import { type ManagementConfig, managementConfig } from "./admin/config";

export type AppEnv = {
  env: EnvConfig;
  gateway: GatewayConfig;
  cors: CorsConfig;
  routes: RoutesConfig;
  auth: AuthConfig;
  proxy: ProxyConfig;
  management: ManagementConfig;
};

export const appEnv: AppEnv = {
  env: envConfig,
  gateway: gatewayConfig,
  cors: corsConfig,
  routes: routesConfig,
  auth: authConfig,
  proxy: proxyConfig,
  management: managementConfig,
} as const satisfies AppEnv;
