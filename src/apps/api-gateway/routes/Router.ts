import type { Server as HttpServer } from "node:http";
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
import { createHealthRouter } from "./HealthRouter";
import { createMetricsRouter } from "./MetricsRouter";
import { metricsCollector } from "../middleware/metrics/MetricsCollector";
import { appEnv } from "../config/app-env";
import { logger } from "../logger";
import { createRequestIdMiddleware, REQUEST_ID_HEADER } from "../middleware/requestId";

export class Router {
  private readonly router: ExpressRouter;
  private reloader: RouteReloader | null = null;

  constructor() {
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
   */
  async init(httpServer?: HttpServer): Promise<void> {
    // Inject / forward X-Request-ID before logging so every log line carries it
    this.router.use(createRequestIdMiddleware());

    // Structured HTTP request logging — reuse the request ID set above
    this.router.use(pinoHttp({ logger, genReqId: (req) => req.headers[REQUEST_ID_HEADER] as string }));

    // Security headers (full helmet defaults)
    this.router.use(helmet());

    // Configurable CORS
    this.configureCors();

    // Body parsing + gzip compression
    this.configureBodyParser();

    // Health check
    this.router.use(createHealthRouter());

    // Prometheus metrics endpoint
    this.router.use(createMetricsRouter(metricsCollector));

    // Hot-reloadable proxy routes
    this.reloader = new RouteReloader(httpServer);
    await this.reloader.start();
    this.router.use(this.reloader.getDelegatorMiddleware());

    // Error handler must be registered last
    this.configureErrorHandler();
  }

  /**
   * Stop the file watcher and remove the SIGHUP reload listener.
   */
  stop(): void {
    this.reloader?.stop();
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
    this.router.use(express.json());
    this.router.use(express.urlencoded({ extended: true }));
    this.router.use(compress());
  }

  private configureErrorHandler(): void {
    this.router.use(
      (error: Error, _req: Request, res: Response, _next: NextFunction): void => {
        logger.error({ err: error }, "Unhandled error");
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          error: "Internal Server Error",
          message: error.message,
        });
      }
    );
  }
}
