import { StatusCodes as HttpStatus } from "http-status-codes";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import { ErrorResponseFactory } from "../../middleware/ErrorResponseFactory";

export class BodyValidationMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    const validationConfig = route.validation;
    if (!validationConfig) return null;

    return (req: Request, res: Response, next: NextFunction): void => {
      // 1. Content-Type check
      if (validationConfig.allowedContentTypes && validationConfig.allowedContentTypes.length > 0) {
        const requestContentType = (req.headers["content-type"] ?? "").toLowerCase();
        const isContentTypeAllowed = validationConfig.allowedContentTypes.some(
          (allowedType) => requestContentType.includes(allowedType.toLowerCase()),
        );
        if (!isContentTypeAllowed) {
          res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json(
            ErrorResponseFactory.validationError(
              `Unsupported Content-Type. Allowed: ${validationConfig.allowedContentTypes.join(", ")}`,
            ),
          );
          return;
        }
      }

      // 2. Body size check (uses Content-Length — does not buffer the stream)
      if (validationConfig.maxBodyBytes !== undefined) {
        const contentLengthHeader = req.headers["content-length"];
        if (contentLengthHeader !== undefined) {
          const contentLengthBytes = parseInt(contentLengthHeader, 10);
          if (!Number.isNaN(contentLengthBytes) && contentLengthBytes > validationConfig.maxBodyBytes) {
            res.status(HttpStatus.REQUEST_TOO_LONG).json(
              ErrorResponseFactory.validationError(
                `Request body exceeds maximum allowed size of ${validationConfig.maxBodyBytes} bytes`,
              ),
            );
            return;
          }
        }
      }

      // 3. Required fields check (body must be an object — Express has already parsed it)
      if (validationConfig.requiredFields && validationConfig.requiredFields.length > 0) {
        const requestBody = req.body as Record<string, unknown> | undefined;
        if (!requestBody || typeof requestBody !== "object") {
          res.status(HttpStatus.UNPROCESSABLE_ENTITY).json(
            ErrorResponseFactory.validationError("Request body must be a JSON object"),
          );
          return;
        }
        const missingFields = validationConfig.requiredFields.filter(
          (fieldName) => requestBody[fieldName] === undefined || requestBody[fieldName] === null,
        );
        if (missingFields.length > 0) {
          res.status(HttpStatus.UNPROCESSABLE_ENTITY).json(
            ErrorResponseFactory.validationError(
              `Missing required fields: ${missingFields.join(", ")}`,
            ),
          );
          return;
        }
      }

      next();
    };
  }
}
