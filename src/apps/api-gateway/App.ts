import { config } from "dotenv";
import { Server } from "./Server";

export class App {
  private readonly server: Server;

  constructor() {
    // Load environment variables from .env file
    config();

    this.server = new Server();
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return await this.server.start();
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return await this.server.stop();
  }
}
