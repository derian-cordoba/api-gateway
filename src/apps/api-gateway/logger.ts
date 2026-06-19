import pino from "pino";
import { appEnv } from "./config/app-env";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(appEnv.env.isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:HH:MM:ss",
      },
    },
  }),
});
