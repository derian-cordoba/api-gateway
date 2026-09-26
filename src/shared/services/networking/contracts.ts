import type { HttpMethod } from "../../http/HttpMethod";
export type { HttpMethod } from "../../http/HttpMethod";
export type HttpHeaders = ConstructorParameters<typeof Headers>[0];
export type QueryValue = string | number | boolean | null | undefined;
export type HttpQuery = Record<string, QueryValue | readonly QueryValue[]>;
export type ResponseType = "json" | "text" | "blob" | "arrayBuffer";

// Node's fetch types omit cache, while Next.js and browsers support it.
export type HttpCache =
  | "default"
  | "no-store"
  | "reload"
  | "no-cache"
  | "force-cache"
  | "only-if-cached";

export type HttpRequestOptions<T = unknown> = Omit<RequestInit, "method"> & {
  method?: HttpMethod;
  cache?: HttpCache;
  query?: HttpQuery;
  // Serialized once; cannot be combined with body.
  json?: unknown;
  responseType?: ResponseType;
  // Zero disables the deadline. Covers transport and body consumption.
  timeoutMs?: number;
  // Optional runtime validation, for example data => schema.parse(data).
  decode?: (data: unknown) => T;
};

/** Both transports return native responses so parsing and errors stay identical. */
export interface HttpTransport {
  send(url: string, init: RequestInit): Promise<Response>;
}

export type HttpManagerOptions = {
  baseURL?: string;
  headers?: HttpHeaders | (() => HttpHeaders);
  timeoutMs?: number;
  cache?: HttpCache;
  transport?: HttpTransport;
};
