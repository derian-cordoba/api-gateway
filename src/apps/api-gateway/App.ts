import { Server } from "./Server";

export class App {
  private readonly server: Server;

  constructor() {
    this.server = new Server();
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return await this.server.start();
  }

  /**
   * Configure security headers using Helmet
   */
  async stop(): Promise<void> {
    return await this.server.stop();
  }
}
