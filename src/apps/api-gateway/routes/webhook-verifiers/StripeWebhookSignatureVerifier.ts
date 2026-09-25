import { createHmac } from "node:crypto";
import { timingSafeStringEqual } from "../../../../shared/security/timingSafeStringEqual";
import type { StripeWebhookConfig } from "../../types/webhook";
import type { WebhookSignatureVerifier } from "./WebhookSignatureVerifier";

export class StripeWebhookSignatureVerifier implements WebhookSignatureVerifier {
  readonly signatureHeaderName = "stripe-signature";
  private readonly seenSignatures = new Map<string, number>();

  constructor(private readonly config: StripeWebhookConfig) { }

  verify(rawBody: Buffer, signatureHeaderValue: string): boolean {
    const signatureParts = signatureHeaderValue.split(",")
      .map((part) => part.trim());
    const timestamp = signatureParts.find((part) => part.startsWith("t="))?.slice(2);
    const receivedSignatures = signatureParts
      .filter((part) => part.startsWith("v1="))
      .map((part) => part.slice(3));

    if (!timestamp || receivedSignatures.length === 0) {
      return false;
    }

    const timestampSeconds = Number(timestamp);
    const toleranceSeconds = this.config.toleranceSeconds ?? 300;

    if (!Number.isFinite(timestampSeconds)) {
      return false;
    }

    if (Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds) {
      return false;
    }

    const signedPayload = `${timestamp}.${rawBody.toString("utf-8")}`;
    const expectedSignature = createHmac("sha256", this.config.secret)
      .update(signedPayload)
      .digest("hex");

    const valid = receivedSignatures.some((signature) =>
      timingSafeStringEqual(expectedSignature, signature),
    );
    if (!valid) {
      return false;
    }

    if (this.config.replayProtection) {
      const now = Date.now() / 1000;
      for (const [key, expiresAt] of this.seenSignatures) {
        if (expiresAt <= now) this.seenSignatures.delete(key);
      }
      const replayKey = `${timestamp}:${expectedSignature}`;
      if (this.seenSignatures.has(replayKey)) {
        return false;
      }

      this.seenSignatures.set(replayKey, timestampSeconds + toleranceSeconds);
    }

    return true;
  }
}
