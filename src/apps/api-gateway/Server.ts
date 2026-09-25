import express, { type Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import { Router } from "./routes/Router";
import { GatewayEventBus } from "./middleware/GatewayEventBus";
import { appEnv } from "./config/app-env";
import { logger } from "./logger";
import type { GatewayRuntimeOptions } from "./GatewayRuntimeOptions";
import { isErrorWithCode } from "../../shared/errors/isErrorWithCode";

export class Server {
  private readonly app: Express;
  private readonly router: Router;
  private readonly httpServer: HttpServer;
  private readonly port: number;
  private readonly prefix: string;
  private readonly eventBus: GatewayEventBus;

  constructor(options: GatewayRuntimeOptions = {}) {
    this.port = appEnv.gateway.port;
    this.prefix = appEnv.gateway.prefix;
    this.router = new Router(options);
    this.app = express();
    this.app.set("trust proxy", appEnv.gateway.trustProxy);
    this.httpServer = createServer(this.app);
    this.eventBus = new GatewayEventBus();
  }

  /**
   * Register all middleware and proxy routes without opening a port.
   * Call this before start() or use it directly in tests with getApp().
   */
  async init(): Promise<void> {
    await this.router.init(
      this.httpServer,
      (routes) => this.eventBus.emit("route:reloaded", routes),
    );
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
   * Returns the underlying HTTP server.
   * Required when tests need to bind to a port and receive upgrade events
   * (e.g. WebSocket proxying), since `getApp().listen()` creates a separate
   * server that does not carry the WebSocket upgrade handlers.
   */
  getHttpServer(): HttpServer {
    return this.httpServer;
  }

  /**
   * The gateway-level typed event bus.
   * Subscribe to gateway lifecycle events such as route reloads and
   * circuit-breaker state transitions.
   */
  getEventBus(): GatewayEventBus {
    return this.eventBus;
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
   * Stop the HTTP server gracefully.
   * Calls closeAllConnections() (Node ≥ 18.2) to forcibly drain keep-alive
   * and upgrade connections so the server closes promptly in tests.
   */
  async stop(): Promise<void> {
    this.router.stop();

    // Forcibly close any keep-alive or WebSocket connections so that
    // httpServer.close() resolves immediately instead of waiting for idle drain.
    if (typeof this.httpServer.closeAllConnections === "function") {
      this.httpServer.closeAllConnections();
    }

    return new Promise((resolve: (value: void | PromiseLike<void>) => void) => {
      this.httpServer.close((error: Error | undefined) => {
        if (error && !isErrorWithCode(error, "ERR_SERVER_NOT_RUNNING")) {
          logger.warn({ err: error }, "Error while stopping server");
        } else {
          logger.info("Gateway stopped");
        }
        resolve();
      });
    });
  }
}
