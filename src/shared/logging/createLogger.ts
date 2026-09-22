import pino, { type Logger } from "pino";

export type LoggerOptions = {
  service: string;
  level?: string;
  pretty?: boolean;
};

export function createLogger({
  service,
  level = "info",
  pretty = false,
}: LoggerOptions): Logger {
  return pino({
    name: service,
    level,
    ...(pretty && {
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
}
