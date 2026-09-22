#!/usr/bin/env node
import { App } from "./App";
import { logger } from "./logger";
import { toError } from "../../shared/errors/toError";

function handleError(cause: unknown): void {
  const error = toError(cause);
  logger.error({ err: error }, "Fatal startup error");
  process.exit(1);
}

/**
 * Bootstrap the application.
 *
 * This function creates a new instance of the App class and starts it.
 *
 * @returns {void}
 */
function bootstrap(): void {
  const app = new App();

  app.start().catch(handleError);

  // Handle process termination signals
  process.on("SIGINT", async () => {
    await app.stop();
    process.exit(0);
  });

  process.on("uncaughtException", async (error: Error) => {
    logger.error({ err: error }, "uncaughtException");
    try {
      await app.stop();
    } catch {
      // ignore stop errors during crash shutdown
    }
    process.exit(1);
  });
}

bootstrap();
