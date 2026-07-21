export declare type JwtAuth = {
  enabled: boolean;
  strategy: "jwt";
  /**
   * Shared secret for HMAC algorithms (HS256, HS384, HS512).
   * Falls back to JWT_SECRET env var.
   */
  secret?: string;
  /**
   * PEM-encoded public key or X.509 certificate for asymmetric algorithms
   * (RS256, RS384, RS512, ES256, ES384, ES512, PS256, PS384, PS512).
   * Falls back to JWT_PUBLIC_KEY env var.
   * When present, publicKey takes precedence over secret.
   */
  publicKey?: string;
  /**
   * Explicit algorithm allowlist. Prevents algorithm confusion attacks.
   * Defaults to ["RS256"] when publicKey is configured, ["HS256"] otherwise.
   */
  algorithms?: string[];
};

export declare type ApiKeyAuth = {
  enabled: boolean;
  strategy: "apiKey";
  /**
   * Name of the header to read the API key from.
   * Defaults to "x-api-key".
   */
  header?: string;
  /**
   * List of valid API keys.
   */
  keys: string[];
};

export declare type BasicAuth = {
  enabled: boolean;
  strategy: "basicAuth";
  /**
   * List of valid username/password pairs.
   * Credentials are compared using a timing-safe algorithm.
   */
  credentials: Array<{ username: string; password: string }>;
  /**
   * The realm string included in the WWW-Authenticate response header.
   * Defaults to "API Gateway".
   */
  realm?: string;
};

export declare type OAuth2Auth = {
  enabled: boolean;
  strategy: "oauth2";
  /**
   * URL of the OAuth 2.0 token introspection endpoint (RFC 7662).
   * The gateway POSTs `token=<opaque_token>` to this endpoint and checks
   * that the `active` field in the response is `true`.
   */
  introspectionUrl: string;
  /**
   * Client ID used for HTTP Basic authentication against the introspection endpoint.
   */
  clientId: string;
  /**
   * Client secret used for HTTP Basic authentication against the introspection endpoint.
   */
  clientSecret: string;
  /**
   * Optional `token_type_hint` parameter sent with the introspection request.
   * Defaults to `"access_token"`.
   */
  tokenTypeHint?: string;
};

export declare type Auth = JwtAuth | ApiKeyAuth | BasicAuth | OAuth2Auth;
