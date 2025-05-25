import { config } from "dotenv";
import { Server } from "./Server";

export class App {
  private readonly server: Server;

  constructor() {
    // Initialize the environment variables
    config();

    // Initialize the server
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
