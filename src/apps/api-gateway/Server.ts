import express, { type Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import { Router } from "./routes/Router";
import { appEnv } from "./config/app-env";
import { logger } from "./logger";

export class Server {
  private readonly app: Express;
  private readonly router: Router;
  private readonly httpServer: HttpServer;
  private readonly port: number;
  private readonly prefix: string;

  constructor() {
    this.port = appEnv.gateway.port;
    this.prefix = appEnv.gateway.prefix;
    this.router = new Router();
    this.app = express();
    this.httpServer = createServer(this.app);
  }

  /**
   * Register all middleware and proxy routes without opening a port.
   * Call this before start() or use it directly in tests with getApp().
   */
  async init(): Promise<void> {
    await this.router.init();
    this.app.use(this.prefix, this.router.getRouter());
  }

  /**
   * Returns the underlying Express application.
   * Useful for integration tests via supertest without binding to a port.
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Initialise routes then start the HTTP server.
   */
  async start(): Promise<void> {
    await this.init();

    return new Promise((resolve: (value: void | PromiseLike<void>) => void) => {
      this.httpServer.listen(this.port, () => {
        logger.info(`Gateway started on port ${this.port} (prefix: ${this.prefix})`);
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server gracefully
   */
  async stop(): Promise<void> {
    return new Promise((resolve: (value: void | PromiseLike<void>) => void) => {
      this.httpServer.close((error: Error | undefined) => {
        if (error) {
          logger.warn({ err: error }, "Error while stopping server");
        } else {
          logger.info("Gateway stopped");
        }
        resolve();
      });
    });
  }
}
