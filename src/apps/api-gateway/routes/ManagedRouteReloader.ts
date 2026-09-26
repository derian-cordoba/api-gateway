import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { GatewayRuntimeOptions } from "../GatewayRuntimeOptions";
import type { Gateway } from "../types/gateway";
import type { GatewayEventBus } from "../middleware/GatewayEventBus";
import type { ConfigurationSyncState } from "../operations/GatewayOperationState";
import type { JsonObject } from "./route-sources/RouteSource";
import type {
  SourceRuntimeStatus,
  SourceSelection,
} from "../../../modules/route-sources/types";
import { SourceSelectionStore } from "../../../modules/route-sources/SourceSelectionStore";
import { RouteSourceRegistry } from "../../../modules/route-sources/RouteSourceRegistry";
import { RouteSourceManager } from "../../../modules/route-sources/RouteSourceManager";
import {
  ConfigurationConflictError,
  RouteStorageError,
} from "../../../modules/route-configuration/domain/errors";
import { ProxyManager, type ProxyBuildResult } from "./ProxyManager";
import { appEnv } from "../config/app-env";
import { logger } from "../logger";

/** Opt-in runtime for named source profiles. Each instance reports its own applied selection. */
export class ManagedRouteReloader {
  private active?: ProxyBuildResult;
  private applied: SourceSelection | null = null;
  private revision: string | null = null;
  private degraded = false;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly instanceId = process.env.GATEWAY_INSTANCE_ID || randomUUID();
  private readonly onSignal = () => {
    void this.refresh();
  };
  private readonly onUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => {
    for (const handler of this.active?.wsHandlers ?? []) {
      handler(request, socket, head);
    }
  };

  constructor(
    private readonly server?: Server,
    private readonly onReloaded?: (routes: readonly Gateway[]) => void,
    private readonly options: GatewayRuntimeOptions = {},
    private readonly eventBus?: GatewayEventBus,
    private readonly onSync?: (state: ConfigurationSyncState) => void,
    private readonly sources = new RouteSourceManager(
      new RouteSourceRegistry(process.env, appEnv.routes.filePath),
    ),
    private readonly selection = new SourceSelectionStore(),
  ) { }

  async start(): Promise<void> {
    try {
      await this.synchronize();
    } catch (cause) {
      await this.stop();
      throw cause;
    }
    this.server?.on("upgrade", this.onUpgrade);
    process.on("SIGHUP", this.onSignal);
    this.schedule();
  }

  getDelegatorMiddleware(): RequestHandler {
    return (request, response, next) =>
      this.active ?
        this.active.router(request, response, next)
        : next();
  }

  async status(): Promise<SourceRuntimeStatus> {
    const desired = await this.selection.read();
    return {
      instanceId: this.instanceId,
      desired,
      applied: this.applied,
      revision: this.revision,
      status:
        this.degraded || desired.version !== this.applied?.version
          ? "degraded"
          : "synchronized",
      activationEnabled: this.selection.enabled,
    };
  }

  activate(
    sourceId: string,
    expectedVersion: number,
    expectedRevision: string,
  ): Promise<SourceRuntimeStatus> {
    return this.serial(async () => {
      if (this.stopped) {
        throw new RouteStorageError("Gateway is stopping.", "unavailable");
      }

      if (!this.selection.enabled) {
        throw new RouteStorageError(
          "A control database is required for activation.",
          "configuration",
        );
      }

      const desired = await this.selection.read();
      if (desired.version !== expectedVersion) {
        throw new ConfigurationConflictError(
          String(expectedVersion),
          String(desired.version),
        );
      }

      const snapshot = await this.sources.snapshot(sourceId);
      if (snapshot.revision !== expectedRevision) {
        throw new ConfigurationConflictError(
          expectedRevision,
          snapshot.revision,
        );
      }

      const prepared = await this.build(snapshot.routes);
      let committed: SourceSelection;
      try {
        committed = await this.selection.select(sourceId, expectedVersion);
      } catch (cause) {
        prepared.dispose?.();
        throw cause;
      }
      await this.apply(prepared, committed, snapshot.revision);
      return this.status();
    });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    process.off("SIGHUP", this.onSignal);
    this.server?.off("upgrade", this.onUpgrade);
    await this.queue;
    this.active?.dispose?.();
    await Promise.all([this.sources.close(), this.selection.close()]);
  }
  private async synchronize(): Promise<void> {
    const desired = await this.selection.read();
    const snapshot = await this.sources.snapshot(desired.sourceId);
    if (
      desired.version !== this.applied?.version ||
      snapshot.revision !== this.revision
    ) {
      const prepared = await this.build(snapshot.routes);
      if (this.stopped) {
        prepared.dispose?.();
        return;
      }
      await this.apply(prepared, desired, snapshot.revision);
    }
    this.degraded = false;
    this.onSync?.({ status: "synchronized", revision: this.revision });
  }

  private build(routes: unknown[]): Promise<ProxyBuildResult> {
    return ProxyManager.build(
      Router(),
      {
        ...this.options,
        routeSource: { load: async () => routes as JsonObject[] },
      },
      this.eventBus,
    );
  }

  private async apply(
    prepared: ProxyBuildResult,
    selection: SourceSelection,
    revision: string,
  ): Promise<void> {
    const previous = this.active;
    const previousSource = this.applied?.sourceId;
    this.active = prepared;
    this.applied = selection;
    this.revision = revision;
    this.degraded = false;
    this.onReloaded?.(prepared.routes);
    this.onSync?.({ status: "synchronized", revision });

    try {
      previous?.dispose?.();
      if (previousSource && previousSource !== selection.sourceId) {
        await this.sources.release(previousSource);
      }
    } catch (cause) {
      logger.warn(
        { err: cause },
        "Could not release previous route source resources",
      );
    }
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async refresh(): Promise<void> {
    try {
      await this.serial(async () => {
        if (!this.stopped) {
          await this.synchronize();
        }
      });
    } catch {
      this.degraded = true;
      this.onSync?.({
        status: "degraded",
        revision: this.revision,
        message:
          "Route source unavailable; serving the last validated configuration.",
      });
    }
  }

  private schedule(): void {
    this.timer = setTimeout(async () => {
      await this.refresh();
      if (!this.stopped) {
        this.schedule();
      }
    }, 2000);
    this.timer.unref();
  }
}
