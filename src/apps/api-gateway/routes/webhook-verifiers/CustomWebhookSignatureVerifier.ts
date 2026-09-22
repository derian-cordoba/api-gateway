import { createHmac } from "node:crypto";
import { timingSafeStringEqual } from "../../../../shared/security/timingSafeStringEqual";
import type { CustomWebhookConfig } from "../../types/webhook";
import type { WebhookSignatureVerifier } from "./WebhookSignatureVerifier";

export class CustomWebhookSignatureVerifier implements WebhookSignatureVerifier {
  readonly signatureHeaderName: string;

  constructor(private readonly config: CustomWebhookConfig) {
    this.signatureHeaderName = config.headerName.toLowerCase();
  }

  verify(rawBody: Buffer, signatureHeaderValue: string): boolean {
    const expectedSignature = createHmac(this.config.hashAlgorithm ?? "sha256", this.config.secret)
      .update(rawBody)
      .digest("hex");

    return timingSafeStringEqual(expectedSignature, signatureHeaderValue);
  }
}
