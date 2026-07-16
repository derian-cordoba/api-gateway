import type { RequestHandler } from "express";
import type { Server as HttpServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { Router as ExpressRouter } from "express";
import { watch, type FSWatcher } from "node:fs";
import { ProxyManager } from "./ProxyManager";
import { appEnv } from "../config/app-env";
import { logger } from "../logger";

export type WsUpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export class RouteReloader {
  private readonly reloadBound = () => void this.reload();
  private readonly DEBOUNCE_MS = 300;

  private innerRouter: ExpressRouter = ExpressRouter();
  private activeWsHandlers: WsUpgradeHandler[] = [];
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly httpServer?: HttpServer) {
    //
  }

  /**
   * Build initial routes and start watching for changes.
   * Must be awaited before the server begins accepting requests.
   */
  async start(): Promise<void> {
    await this.reload();
    this.attachStableWsHandler();
    this.startWatcher();
    process.on("SIGHUP", this.reloadBound);
    logger.info("Hot config reload enabled");
  }

  /**
   * Returns the stable delegating middleware to mount on the Express app once.
   * It forwards every request to the current inner router, which is swapped on reload.
   */
  getDelegatorMiddleware(): RequestHandler {
    return (req, res, next) => this.innerRouter(req, res, next);
  }

  /**
   * Stop watching the routes file and remove the SIGHUP listener.
   * Safe to call multiple times.
   */
  stop(): void {
    process.off("SIGHUP", this.reloadBound);
    this.watcher?.close();
    this.watcher = null;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async reload(): Promise<void> {
    try {
      logger.info("Reloading routes config...");
      const newRouter = ExpressRouter();
      const { router, wsHandlers } = await ProxyManager.build(newRouter);
      // JS assignment is single-threaded — new requests see the new router immediately
      this.innerRouter = router as ExpressRouter;
      this.activeWsHandlers = wsHandlers;
      logger.info("Routes reloaded successfully");
    } catch (err) {
      logger.error({ err }, "Failed to reload routes — keeping current config");
    }
  }

  /**
   * Add ONE stable 'upgrade' listener to the HTTP server at startup.
   * It dispatches to the current set of active WS handlers, which are swapped on reload.
   * This avoids accumulating stale listeners across multiple reloads.
   */
  private attachStableWsHandler(): void {
    if (!this.httpServer) return;
    this.httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      for (const handler of this.activeWsHandlers) {
        handler(req, socket, head);
      }
    });
  }

  private startWatcher(): void {
    const filePath = appEnv.routes.filePath;
    try {
      this.watcher = watch(filePath, () => {
        if (this.debounceTimer !== null) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          void this.reload();
        }, this.DEBOUNCE_MS);
      });
      this.watcher.on("error", (err) => logger.warn({ err }, "Routes file watcher error"));
      logger.info({ filePath }, "Watching routes file for changes");
    } catch (err) {
      logger.warn({ err, filePath }, "Could not watch routes file — file-based reload disabled");
    }
  }
}
