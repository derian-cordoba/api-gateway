import { createHmac } from "node:crypto";
import { timingSafeStringEqual } from "../../../../shared/security/timingSafeStringEqual";
import type { StripeWebhookConfig } from "../../types/webhook";
import type { WebhookSignatureVerifier } from "./WebhookSignatureVerifier";

export class StripeWebhookSignatureVerifier implements WebhookSignatureVerifier {
  readonly signatureHeaderName = "stripe-signature";

  constructor(private readonly config: StripeWebhookConfig) {}

  verify(rawBody: Buffer, signatureHeaderValue: string): boolean {
    const signatureParts = signatureHeaderValue.split(",");
    const timestamp = signatureParts.find((part) => part.startsWith("t="))?.slice(2);
    const receivedSignature = signatureParts.find((part) => part.startsWith("v1="))?.slice(3);

    if (!timestamp || !receivedSignature) return false;

    const signedPayload = `${timestamp}.${rawBody.toString("utf-8")}`;
    const expectedSignature = createHmac("sha256", this.config.secret)
      .update(signedPayload)
      .digest("hex");

    return timingSafeStringEqual(expectedSignature, receivedSignature);
  }
}
