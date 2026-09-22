import type { WebhookConfig } from "../../types/webhook";
import { CustomWebhookSignatureVerifier } from "./CustomWebhookSignatureVerifier";
import { GitHubWebhookSignatureVerifier } from "./GitHubWebhookSignatureVerifier";
import { StripeWebhookSignatureVerifier } from "./StripeWebhookSignatureVerifier";
import type {
  WebhookSignatureVerifier,
  WebhookSignatureVerifierResolver,
} from "./WebhookSignatureVerifier";

export class WebhookSignatureVerifierFactory implements WebhookSignatureVerifierResolver {
  create(config: WebhookConfig): WebhookSignatureVerifier {
    switch (config.provider) {
      case "github":
        return new GitHubWebhookSignatureVerifier(config);
      case "stripe":
        return new StripeWebhookSignatureVerifier(config);
      case "custom":
        return new CustomWebhookSignatureVerifier(config);
      default:
        return this.assertUnsupportedProvider(config);
    }
  }

  private assertUnsupportedProvider(provider: never): never {
    throw new Error(`Unsupported webhook provider: ${String(provider)}`);
  }
}
