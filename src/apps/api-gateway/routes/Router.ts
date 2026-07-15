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
import { ProxyManager } from "./ProxyManager";
import { createHealthRouter } from "./HealthRouter";
import { appEnv } from "../config/app-env";
import { logger } from "../logger";
import { createRequestIdMiddleware, REQUEST_ID_HEADER } from "../middleware/requestId";

export class Router {
  private readonly router: ExpressRouter;

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
  async init(): Promise<void> {
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

    // Proxy routes (async — reads config file / env var)
    await this.configureProxyManager();

    // Error handler must be registered last
    this.configureErrorHandler();
  }

  private configureCors(): void {
    const { origins, methods, allowedHeaders } = appEnv.cors;
    this.router.use(
      cors({
        origin: origins,
        methods,
        allowedHeaders,
      })
    );
  }

  private configureBodyParser(): void {
    this.router.use(express.json());
    this.router.use(express.urlencoded({ extended: true }));
    this.router.use(compress());
  }

  private async configureProxyManager(): Promise<void> {
    const proxyManager = new ProxyManager(this.router);
    await proxyManager.registerProxyRoutes();
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
