import { createLogger } from "../../shared/logging/createLogger";
import { appEnv } from "./config/app-env";

export const logger = createLogger({
  service: "api-gateway",
  level: process.env.LOG_LEVEL,
  pretty: appEnv.env.isDev,
});
