import type { RequestHandler } from "express";
import type { Server as HttpServer } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { Router as ExpressRouter } from "express";
import { watch, type FSWatcher } from "node:fs";
import { basename, dirname } from "node:path";
import type { ConfigurationSyncState } from "../operations/GatewayOperationState";
import type { GatewayRuntimeOptions } from "../GatewayRuntimeOptions";
import type { GatewayEventBus } from "../middleware/GatewayEventBus";
import type { Gateway } from "../types/gateway"
import { ProxyManager } from "./ProxyManager";
import { appEnv } from "../config/app-env";
import { logger } from "../logger";
import { toError } from "../../../shared/errors/toError";
import { RouteStorageManager } from "../../../modules/route-configuration/infrastructure/RouteStorageManager";
import { databaseStorageEnabled } from "../../../modules/route-configuration/infrastructure/config/storage-config";
import { DatabaseRouteSource } from "./route-sources/DatabaseRouteSource";

export type WsUpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

export class RouteReloader {
  private readonly reloadBound = () => void this.reload();
  private readonly DEBOUNCE_MS = appEnv.proxy.routesDebounceMs;

  private innerRouter: ExpressRouter = ExpressRouter();
  private activeWsHandlers: WsUpgradeHandler[] = [];
  private disposeActiveRoutes: (() => void) | null = null;
  private watcher: FSWatcher | null = null;
  private storage?: RouteStorageManager;
  private databaseSource?: DatabaseRouteSource;
  private appliedRevision: string | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private reloadQueue: Promise<void> = Promise.resolve();
  private stopped = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly httpServer?: HttpServer,
    private readonly onReloaded?: (routes: readonly Gateway[]) => void,
    private readonly runtimeOptions: GatewayRuntimeOptions = {},
    private readonly eventBus?: GatewayEventBus,
    private readonly onStorageSync?: (state: ConfigurationSyncState) => void,
  ) {
    //
  }

  /**
   * Build initial routes and start watching for changes.
   * Must be awaited before the server begins accepting requests.
   */
  async start(): Promise<void> {
    // The first configuration must load successfully before the gateway can
    // accept traffic or report itself ready. Later reloads retain last good.
    this.stopped = false;
    this.storage = this.runtimeOptions.routeStorageManager ?? (databaseStorageEnabled() ? new RouteStorageManager() : undefined);
    try {
      if (this.storage) {
        const repository = await this.storage.getRepository();
        this.databaseSource = new DatabaseRouteSource(repository);
      }
      await this.reload(true);
    } catch (error) {
      if (this.storage && !this.runtimeOptions.routeStorageManager) {
        await this.storage.close();
      }

      throw error;
    }

    this.attachStableWsHandler();

    if (this.storage) {
      this.schedulePoll();
    } else {
      this.startWatcher();
    }

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
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    this.pollTimer = null;

    process.off("SIGHUP", this.reloadBound);

    this.watcher?.close();
    this.watcher = null;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    await this.reloadQueue;

    this.disposeActiveRoutes?.();
    this.disposeActiveRoutes = null;

    if (this.storage && !this.runtimeOptions.routeStorageManager) {
      await this.storage.close();
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private reload(initial = false): Promise<void> {
    const task = this.reloadQueue.then(() => this.performReload(initial));
    this.reloadQueue = task.catch(() => undefined);
    return task;
  }

  private async performReload(initial = false): Promise<void> {
    if (this.stopped) {
      return;
    }

    try {
      logger.info("Reloading routes config...");
      const newRouter = ExpressRouter();
      const { router, wsHandlers, routes, dispose } = await ProxyManager.build(newRouter, {
        ...this.runtimeOptions,
        ...(this.databaseSource && { routeSource: this.databaseSource }),
      }, this.eventBus);

      if (this.stopped) {
        dispose?.();
        return;
      }

      // JS assignment is single-threaded — new requests see the new router immediately
      this.disposeActiveRoutes?.();
      this.innerRouter = router as ExpressRouter;
      this.activeWsHandlers = wsHandlers;
      this.disposeActiveRoutes = dispose ?? null;
      logger.info("Routes reloaded successfully");

      this.onReloaded?.(routes);
      if (this.databaseSource) {
        this.appliedRevision = this.databaseSource.loadedRevision;
        this.onStorageSync?.({ status: "synchronized", revision: this.appliedRevision });
      }
    } catch (err) {
      if (this.storage) {
        this.onStorageSync?.({ status: "degraded", revision: this.appliedRevision, message: "Could not synchronize route configuration." });
      }

      logger.error({ err: toError(err) }, "Failed to reload routes — keeping current config");

      if (initial) {
        throw err;
      }
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

  private schedulePoll(): void {
    if (this.stopped || !this.storage) {
      return;
    }

    this.pollTimer = setTimeout(
      () => void this.pollDatabase(),
      this.storage.config.pollIntervalMs,
    );
    this.pollTimer.unref();
  }

  private async pollDatabase(): Promise<void> {
    try {
      if (this.stopped || !this.databaseSource) {
        return;
      }
      const revision = await this.databaseSource.head();
      if (revision !== this.appliedRevision) {
        await this.reload();
      } else {
        this.onStorageSync?.({ status: "synchronized", revision: this.appliedRevision });
      }
    } catch {
      this.onStorageSync?.({
        status: "degraded",
        revision: this.appliedRevision,
        message: "Route database is unavailable; serving the last validated configuration.",
      });
    } finally {
      this.schedulePoll();
    }
  }

  private startWatcher(): void {
    const filePath = appEnv.routes.filePath;
    const directoryPath = dirname(filePath);
    const routesFileName = basename(filePath);
    try {
      // Watch the containing directory so atomic file replacement (temp file + rename)
      // does not detach the watcher from the old inode.
      this.watcher = watch(directoryPath, (_eventType, changedFileName) => {
        if (changedFileName !== null && changedFileName.toString() !== routesFileName) return;
        if (this.debounceTimer !== null) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          this.debounceTimer = null;
          void this.reload();
        }, this.DEBOUNCE_MS);
      });
      this.watcher.on("error", (err) => logger.warn({ err }, "Routes file watcher error"));
      logger.info({ filePath, directoryPath }, "Watching routes file for changes");
    } catch (err) {
      logger.warn({ err: toError(err), filePath }, "Could not watch routes file — file-based reload disabled");
    }
  }
}
