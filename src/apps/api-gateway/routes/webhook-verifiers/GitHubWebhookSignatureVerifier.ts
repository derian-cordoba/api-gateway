import { createHmac } from "node:crypto";
import { timingSafeStringEqual } from "../../../../shared/security/timingSafeStringEqual";
import type { GitHubWebhookConfig } from "../../types/webhook";
import type { WebhookSignatureVerifier } from "./WebhookSignatureVerifier";

export class GitHubWebhookSignatureVerifier implements WebhookSignatureVerifier {
  readonly signatureHeaderName = "x-hub-signature-256";

  constructor(private readonly config: GitHubWebhookConfig) {}

  verify(rawBody: Buffer, signatureHeaderValue: string): boolean {
    const digest = createHmac("sha256", this.config.secret).update(rawBody).digest("hex");
    return timingSafeStringEqual(`sha256=${digest}`, signatureHeaderValue);
  }
}
