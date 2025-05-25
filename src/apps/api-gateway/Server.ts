import express, { type Express } from "express";
import { createServer, type Server as HttpServer } from "http";
import { Router } from "./routes/Router";
import { appEnv } from "./config/app-env";

export class Server {
  private readonly app: Express;
  private readonly router: Router;
  private readonly httpServer: HttpServer;
  private readonly port: number;

  constructor() {
    this.port = appEnv.gateway.port;
    this.router = new Router();
    this.app = express();
    this.httpServer = createServer(this.app);

    this.app.use(this.router.getRouter());
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve: (value: void | PromiseLike<void>) => void) => {
      this.httpServer.listen(this.port, () => {
        console.log(`Gateway started on port ${this.port}`);
        console.info("Press CTRL-C to stop\n");
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return new Promise(
      (
        resolve: (value: void | PromiseLike<void>) => void,
        reject: (reason?: any) => void
      ) => {
        this.httpServer.close((error: Error | void) => {
          if (error) {
            return reject(error);
          }
          resolve();
        });
      }
    );
  }
}
