import type { WebhookConfig } from "../../types/webhook";

export interface WebhookSignatureVerifier {
  readonly signatureHeaderName: string;

  verify(rawBody: Buffer, signatureHeaderValue: string): boolean;
}

export interface WebhookSignatureVerifierResolver {
  create(config: WebhookConfig): WebhookSignatureVerifier;
}
