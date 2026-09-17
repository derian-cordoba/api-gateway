export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type GatewayRoute = {
  baseURL: string;
  proxy: {
    target?: string;
    targets?: Array<{ url: string; weight?: number }>;
    strategy?: "round-robin" | "weighted" | "least-connections" | "sticky";
    stickyKey?: string;
    isSecure?: boolean;
    changeOrigin?: boolean;
    pathRewrite?: Record<string, string>;
    headers?: Record<string, string>;
    method?: HttpMethod;
    timeout?: number;
    ws?: boolean;
  };
  rateLimit?: {
    max: number;
    windowMs: number;
    statusCode?: number;
    message?: string;
    keyBy?: string;
  };
  auth?:
    | {
        enabled: boolean;
        strategy: "jwt";
        secret?: string;
        publicKey?: string;
        algorithms?: string[];
        jwksUri?: string;
        authRateLimit?: AuthRateLimit;
      }
    | {
        enabled: boolean;
        strategy: "apiKey";
        header?: string;
        keys: string[];
        authRateLimit?: AuthRateLimit;
      }
    | {
        enabled: boolean;
        strategy: "basicAuth";
        credentials: Array<{ username: string; password: string }>;
        realm?: string;
        authRateLimit?: AuthRateLimit;
      }
    | {
        enabled: boolean;
        strategy: "oauth2";
        introspectionUrl: string;
        clientId: string;
        clientSecret: string;
        tokenTypeHint?: string;
        introspectionCacheTtlMs?: number;
        authRateLimit?: AuthRateLimit;
      };
  circuitBreaker?: {
    threshold: number;
    timeout: number;
    successThreshold?: number;
    healthCheck?: { url: string; intervalMs: number; timeoutMs?: number };
  };
  ipFilter?: { allow?: string[]; deny?: string[] };
  retry?: {
    attempts: number;
    delay: number;
    backoff?: "fixed" | "exponential" | "exponential-jitter";
    retryOn?: number[];
    retryMethods?: string[];
  };
  cache?: {
    ttl: number;
    methods?: string[];
    statusCodes?: number[];
    staleWhileRevalidateMs?: number;
    evictionIntervalMs?: number;
  };
  headers?: {
    request?: HeaderTransform;
    response?: HeaderTransform;
  };
  cors?: {
    origin: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  };
};

export type AuthRateLimit = { max: number; windowMs: number };
export type HeaderTransform = { set?: Record<string, string>; remove?: string[] };

export type ConfigurationWarning = { path: Array<string | number>; message: string };

export type StoredConfiguration = {
  routes: GatewayRoute[];
  revision: string;
  updatedAt: string | null;
  filePath: string;
  warnings: ConfigurationWarning[];
};

export type ValidationIssue = { path: Array<string | number>; message: string };

