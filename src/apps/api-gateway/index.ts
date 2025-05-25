import { App } from "./App";

function handleError(error: Error): void {
  console.log(error);
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
    console.log("uncaughtException", error);
    await app.stop();
    process.exit(1);
  });
}

bootstrap();
