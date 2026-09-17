import { createHmac, timingSafeEqual } from "node:crypto";
import { StatusCodes as HttpStatus } from "http-status-codes";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { Gateway } from "../../types/gateway";
import type { WebhookConfig } from "../../types/webhook";
import type { MiddlewareFactory } from "./MiddlewareFactory";
import { ErrorResponseFactory } from "../../middleware/ErrorResponseFactory";

export class WebhookMiddlewareFactory implements MiddlewareFactory {
  create(route: Gateway): RequestHandler | null {
    const webhookConfig = route.webhook;

    if (!webhookConfig) return null;

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

      const signatureHeaderName = this.resolveSignatureHeaderName(webhookConfig);
      const signatureHeaderValue = req.headers[signatureHeaderName] as string | undefined;

      if (!signatureHeaderValue) {
        res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.webhookSignatureInvalid());
        return;
      }

      const isSignatureValid = this.verifySignature(
        rawBodyBuffer,
        signatureHeaderValue,
        webhookConfig,
      );

      if (!isSignatureValid) {
        res.status(HttpStatus.UNAUTHORIZED).json(ErrorResponseFactory.webhookSignatureInvalid());
        return;
      }

      next();
    };
  }

  private resolveSignatureHeaderName(webhookConfig: WebhookConfig): string {
    if (webhookConfig.provider === "github") {
      return "x-hub-signature-256";
    }

    if (webhookConfig.provider === "stripe") {
      return "stripe-signature";
    }

    // For "custom" providers, headerName is guaranteed present by the schema validator.
    return (webhookConfig.headerName as string).toLowerCase();
  }

  private verifySignature(
    rawBodyBuffer: Buffer,
    signatureHeaderValue: string,
    webhookConfig: WebhookConfig,
  ): boolean {
    if (webhookConfig.provider === "github") {
      return this.verifyGitHub(rawBodyBuffer, signatureHeaderValue, webhookConfig.secret);
    }

    if (webhookConfig.provider === "stripe") {
      return this.verifyStripe(rawBodyBuffer, signatureHeaderValue, webhookConfig.secret);
    }

    const hashAlgorithm = webhookConfig.hashAlgorithm ?? "sha256";
    return this.verifyCustom(rawBodyBuffer, signatureHeaderValue, webhookConfig.secret, hashAlgorithm);
  }

  private verifyGitHub(
    rawBodyBuffer: Buffer,
    signatureHeaderValue: string,
    secret: string,
  ): boolean {
    const expectedSignature =
      "sha256=" + createHmac("sha256", secret).update(rawBodyBuffer).digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
    const receivedBuffer = Buffer.from(signatureHeaderValue, "utf-8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private verifyStripe(
    rawBodyBuffer: Buffer,
    signatureHeaderValue: string,
    secret: string,
  ): boolean {
    // Stripe signature format: "t=<timestamp>,v1=<hex_signature>"
    const signatureParts = signatureHeaderValue.split(",");

    const timestampPart = signatureParts.find((part) => part.startsWith("t="));
    const v1Part = signatureParts.find((part) => part.startsWith("v1="));

    if (!timestampPart || !v1Part) {
      return false;
    }

    const timestamp = timestampPart.slice("t=".length);
    const receivedSignature = v1Part.slice("v1=".length);

    if (!timestamp || !receivedSignature) {
      return false;
    }

    const signedPayload = timestamp + "." + rawBodyBuffer.toString("utf-8");
    const expectedSignature = createHmac("sha256", secret).update(signedPayload).digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
    const receivedBuffer = Buffer.from(receivedSignature, "utf-8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private verifyCustom(
    rawBodyBuffer: Buffer,
    signatureHeaderValue: string,
    secret: string,
    algorithm: string,
  ): boolean {
    const expectedSignature = createHmac(algorithm, secret).update(rawBodyBuffer).digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
    const receivedBuffer = Buffer.from(signatureHeaderValue, "utf-8");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }
}
