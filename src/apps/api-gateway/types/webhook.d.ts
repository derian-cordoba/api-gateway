export declare type WebhookConfig = {
  /**
   * Webhook provider preset. Each preset knows the correct signature header
   * and hashing scheme for that provider.
   *
   * - `"github"` — `X-Hub-Signature-256: sha256=<hex>`, HMAC-SHA256 of the raw body.
   * - `"stripe"` — `Stripe-Signature: t=<ts>,v1=<hex>`, timestamp + HMAC-SHA256.
   * - `"custom"` — configure `headerName` and `hashAlgorithm` explicitly.
   */
  provider: "github" | "stripe" | "custom";

  /**
   * Shared secret used to compute the expected signature.
   */
  secret: string;

  /**
   * Override the header name that carries the signature.
   * Required when `provider` is `"custom"`.
   * Ignored for `"github"` and `"stripe"` (their header names are fixed).
   */
  headerName?: string;

  /**
   * Hash algorithm for `"custom"` providers (e.g. `"sha256"`, `"sha1"`).
   * Defaults to `"sha256"` when `provider` is `"custom"`.
   */
  hashAlgorithm?: string;
};
