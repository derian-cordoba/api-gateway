import { ManagedRouteReloader } from "./ManagedRouteReloader";
import type { Server as HttpServer } from "node:http";
import { randomUUID } from "node:crypto";
import type { Gateway } from "../types/gateway";
import express, {
  Router as ExpressRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { StatusCodes as HttpStatus } from "http-status-codes";
import cors from "cors";
import compress from "compression";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { RouteReloader } from "./RouteReloader";
import { createHealthRouter, type HealthState } from "./HealthRouter";
import { createMetricsRouter } from "./MetricsRouter";
import { metricsCollector } from "../middleware/metrics/MetricsCollector";
import { appEnv } from "../config/app-env";
import { logger } from "../logger";
import { createRequestIdMiddleware, REQUEST_ID_HEADER } from "../middleware/requestId";
import { createTraceContextMiddleware } from "../middleware/traceContext";
import { toError } from "../../../shared/errors/toError";
import { getHeaderValue } from "../../../shared/http/getHeaderValue";
import type { GatewayRuntimeOptions } from "../GatewayRuntimeOptions";
import type { GatewayEventBus } from "../middleware/GatewayEventBus";
import type { GatewayOperationState } from "../operations/GatewayOperationState";
import { createManagementRouter } from "./ManagementRouter";

export class Router {
  private readonly router: ExpressRouter;
  private reloader: RouteReloader | ManagedRouteReloader | null = null;
  private readonly healthState: HealthState = { ready: false };

  constructor(
    private readonly runtimeOptions: GatewayRuntimeOptions = {},
    private readonly eventBus?: GatewayEventBus,
    private readonly operationState?: GatewayOperationState,
  ) {
    this.router = ExpressRouter();
  }

  /**
   * Get the router instance for the application
   */
  getRouter(): ExpressRouter {
    return this.router;
  }

  /**
   * Initialise all middleware and routes. Must be awaited before the HTTP
   * server starts listening so that proxy routes are registered in time.
   *
   * @param httpServer - Optional HTTP server for WebSocket upgrade support.
   * @param onRouteReloaded - Optional callback invoked after routes are
   *   successfully loaded or reloaded with the active route list.
   */
  async init(
    httpServer?: HttpServer,
    onRouteReloaded?: (routes: readonly Gateway[]) => void,
  ): Promise<void> {
    // Inject / forward X-Request-ID before logging so every log line carries it
    this.router.use(createRequestIdMiddleware());
    this.router.use(createTraceContextMiddleware());

    // Structured HTTP request logging — reuse the request ID set above
    this.router.use(
      pinoHttp({
        logger,
        genReqId: (req) => getHeaderValue(req.headers[REQUEST_ID_HEADER]) ?? randomUUID(),
      }),
    );

    // Security headers (full helmet defaults)
    this.router.use(helmet());

    // Configurable CORS
    this.configureCors();

    // Body parsing + gzip compression
    this.configureBodyParser();

    // Health check
    this.router.use(createHealthRouter(this.healthState));

    // Prometheus metrics endpoint
    this.router.use(createMetricsRouter(metricsCollector));

    // Hot-reloadable proxy routes
    const useManagedSources =
      !!(process.env.ROUTE_SOURCE_PROFILES || process.env.ROUTE_CONTROL_SQLITE_PATH || process.env.ROUTE_CONTROL_POSTGRES_URL)
      && !this.runtimeOptions.routeSource
      && !this.runtimeOptions.routeStorageManager;

    const Reloader = useManagedSources ? ManagedRouteReloader : RouteReloader;
    this.reloader = new Reloader(
      httpServer,
      onRouteReloaded,
      this.runtimeOptions,
      this.eventBus, (state) => this.operationState?.setConfigurationSync(state),
    );

    await this.reloader.start();

    if (appEnv.management.enabled && this.operationState) {
      this.router.use(
        appEnv.management.prefix,
        createManagementRouter(
          this.operationState,
          metricsCollector,
          appEnv.management,
          this.reloader instanceof ManagedRouteReloader ? this.reloader : undefined),
      );
    }

    this.healthState.ready = true;
    this.operationState?.setReady(true);
    this.router.use(this.reloader.getDelegatorMiddleware());

    // Error handler must be registered last
    this.configureErrorHandler();
  }

  /**
   * Stop the file watcher and remove the SIGHUP reload listener.
   */
  async stop(): Promise<void> {
    await this.reloader?.stop();
  }

  private configureCors(): void {
    const { origins, methods, allowedHeaders } = appEnv.cors;
    this.router.use(
      cors({
        origin: origins,
        methods,
        allowedHeaders,
        // Allow OPTIONS to continue so that per-route cors middleware can
        // handle preflight with route-specific policies. Routes without a
        // cors override forward OPTIONS to the upstream via the proxy.
        preflightContinue: true,
      })
    );
  }

  private configureBodyParser(): void {
    this.router.use(
      express.json({
        verify: (_req, _res, rawBodyBuffer) => {
          (_req as Request & { rawBody?: Buffer }).rawBody = rawBodyBuffer;
        },
      }),
    );
    this.router.use(express.urlencoded({ extended: true }));
    this.router.use(compress());
  }

  private configureErrorHandler(): void {
    this.router.use(
      (cause: unknown, _req: Request, res: Response, _next: NextFunction): void => {
        const error = toError(cause);
        logger.error({ err: error }, "Unhandled error");
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: "Internal Server Error",
          message: error.message,
        });
      }
    );
  }
}
