import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CustomWebhookSignatureVerifier } from "../../../src/apps/api-gateway/routes/webhook-verifiers/CustomWebhookSignatureVerifier";
import { GitHubWebhookSignatureVerifier } from "../../../src/apps/api-gateway/routes/webhook-verifiers/GitHubWebhookSignatureVerifier";
import { StripeWebhookSignatureVerifier } from "../../../src/apps/api-gateway/routes/webhook-verifiers/StripeWebhookSignatureVerifier";
import { WebhookSignatureVerifierFactory } from "../../../src/apps/api-gateway/routes/webhook-verifiers/WebhookSignatureVerifierFactory";

const rawBody = Buffer.from('{"event":"created"}');
const secret = "webhook-secret";

describe("webhook signature verifiers", () => {
  it("verifies GitHub's prefixed HMAC-SHA256 signature", () => {
    const verifier = new GitHubWebhookSignatureVerifier({ provider: "github", secret });
    const digest = createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(verifier.signatureHeaderName).toBe("x-hub-signature-256");
    expect(verifier.verify(rawBody, `sha256=${digest}`)).toBe(true);
    expect(verifier.verify(rawBody, "sha256=invalid")).toBe(false);
  });

  it("verifies Stripe's timestamped HMAC-SHA256 signature", () => {
    const verifier = new StripeWebhookSignatureVerifier({ provider: "stripe", secret });
    const timestamp = "1700000000";
    const digest = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody.toString("utf-8")}`)
      .digest("hex");

    expect(verifier.signatureHeaderName).toBe("stripe-signature");
    expect(verifier.verify(rawBody, `t=${timestamp},v1=${digest}`)).toBe(true);
    expect(verifier.verify(rawBody, `t=${timestamp}`)).toBe(false);
  });

  it("verifies a custom provider using its configured header and algorithm", () => {
    const verifier = new CustomWebhookSignatureVerifier({
      provider: "custom",
      secret,
      headerName: "X-Webhook-Signature",
      hashAlgorithm: "sha512",
    });
    const digest = createHmac("sha512", secret).update(rawBody).digest("hex");

    expect(verifier.signatureHeaderName).toBe("x-webhook-signature");
    expect(verifier.verify(rawBody, digest)).toBe(true);
    expect(verifier.verify(rawBody, "invalid")).toBe(false);
  });

  it("creates the matching verifier for every provider", () => {
    const factory = new WebhookSignatureVerifierFactory();

    expect(factory.create({ provider: "github", secret })).toBeInstanceOf(
      GitHubWebhookSignatureVerifier,
    );
    expect(factory.create({ provider: "stripe", secret })).toBeInstanceOf(
      StripeWebhookSignatureVerifier,
    );
    expect(
      factory.create({ provider: "custom", secret, headerName: "x-signature" }),
    ).toBeInstanceOf(CustomWebhookSignatureVerifier);
  });
});
