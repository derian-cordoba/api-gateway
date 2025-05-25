import express, {
  Router as ExpressRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import HttpStatus from "http-status";
import cors from "cors";
import compress from "compression";
import helmet from "helmet";

export class Router {
  private readonly router: ExpressRouter;

  constructor() {
    // Create a new instance of the
    this.router = ExpressRouter();

    // Handle errors in the application
    this.configureErrorHandler();

    // Enable CORS
    this.configureCors();

    // Configure the router to use JSON and URL encoded body parser
    this.configureBodyParser();

    // Configure security headers
    this.configureHelmet();

    // Enable gzip compression
    this.router.use(compress());
  }

  /**
   * Get the router instance for the application
   *
   * @returns {ExpressRouter} The router instance
   */
  getRouter(): ExpressRouter {
    return this.router;
  }

  /**
   * Configure the error handler for the application
   */
  private configureErrorHandler(): void {
    this.router.use(
      (error: Error, _: Request, res: Response, __: NextFunction): void => {
        console.error(error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(error);
      }
    );
  }

  /**
   * Enable Cross-Origin Resource Sharing (CORS)
   */
  private configureCors(): void {
    this.router.use(cors());
  }

  /**
   * Configure body parsers for the application
   */
  private configureBodyParser(): void {
    this.router.use(express.json());
    this.router.use(express.urlencoded({ extended: true }));
  }

  /**
   * Configure security headers using Helmet
   */
  private configureHelmet(): void {
    this.router.use(helmet.xssFilter());
    this.router.use(helmet.noSniff());
    this.router.use(helmet.hidePoweredBy());
    this.router.use(helmet.frameguard({ action: "deny" }));
  }
}
