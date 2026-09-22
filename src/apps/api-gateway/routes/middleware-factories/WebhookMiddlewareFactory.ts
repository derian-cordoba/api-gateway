import { StatusCodes as HttpStatus } from "http-status-codes";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import { ErrorResponseFactory } from "../../middleware/ErrorResponseFactory";
import { getHeaderValue } from "../../../../shared/http/getHeaderValue";
import { WebhookSignatureVerifierFactory } from "../webhook-verifiers/WebhookSignatureVerifierFactory";
import type { WebhookSignatureVerifierResolver } from "../webhook-verifiers/WebhookSignatureVerifier";

export class WebhookMiddlewareFactory implements MiddlewareFactory {
  constructor(
    private readonly verifierFactory: WebhookSignatureVerifierResolver =
      new WebhookSignatureVerifierFactory(),
  ) {}

  create(route: Gateway): RequestHandler | null {
    const webhookConfig = route.webhook;

    if (!webhookConfig) return null;

    const verifier = this.verifierFactory.create(webhookConfig);

    return (req: Request, res: Response, next: NextFunction): void => {
      const rawBodyBuffer = req.rawBody;

      if (!rawBodyBuffer) {
        res
          .status(HttpStatus.BAD_REQUEST)
          .json(
            ErrorResponseFactory.unauthorized(
              "Raw body not available — ensure the body parser is configured with verify enabled",
            ),
          );
        return;
      }

      const signatureHeaderValue = getHeaderValue(req.headers[verifier.signatureHeaderName]);

      if (!signatureHeaderValue) {
        res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.webhookSignatureInvalid());
        return;
      }

      const isSignatureValid = verifier.verify(rawBodyBuffer, signatureHeaderValue);

      if (!isSignatureValid) {
        res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.webhookSignatureInvalid());
        return;
      }

      next();
    };
  }
}
