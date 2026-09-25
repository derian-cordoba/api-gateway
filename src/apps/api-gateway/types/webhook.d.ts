export declare type WebhookProvider = "github" | "stripe" | "custom";

export declare type GitHubWebhookConfig = {
  /**
   * Uses `X-Hub-Signature-256: sha256=<hex>` and HMAC-SHA256 of the raw body.
   */
  provider: "github";

  /**
   * Shared secret used to compute the expected signature.
   */
  secret: string;

  /** Ignored because GitHub uses the fixed `X-Hub-Signature-256` header. */
  headerName?: string;

  /** Ignored because GitHub requires HMAC-SHA256. */
  hashAlgorithm?: string;
};

export declare type StripeWebhookConfig = {
  provider: "stripe";
  secret: string;
  /** Ignored because Stripe uses the fixed `Stripe-Signature` header. */
  headerName?: string;
  /** Ignored because Stripe requires HMAC-SHA256. */
  hashAlgorithm?: string;
  /** Maximum age of the signed timestamp in seconds. Defaults to 300. */
  toleranceSeconds?: number;
  /** Reject the same timestamp/signature pair more than once in this process. */
  replayProtection?: boolean;
};

export declare type CustomWebhookConfig = {
  provider: "custom";
  secret: string;
  headerName: string;
  /** Defaults to `sha256`. */
  hashAlgorithm?: string;
};

export declare type WebhookConfig =
  | GitHubWebhookConfig
  | StripeWebhookConfig
  | CustomWebhookConfig;
