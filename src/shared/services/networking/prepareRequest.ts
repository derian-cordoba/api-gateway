import { HttpMethod } from "../../http/HttpMethod";
import { withErrorContext } from "../../errors/withErrorContext";
import * as Headers from "../../http/Headers";
import { buildURL } from "./buildURL";
import type { HttpManagerOptions, HttpRequestOptions } from "./contracts";
import { HttpError } from "./HttpError";

export function prepareRequest<T>(
  path: string,
  options: HttpRequestOptions<T>,
  defaults: HttpManagerOptions,
  signal: AbortSignal,
): Promise<{ url: string; init: RequestInit }> {
  return withErrorContext(
    () => {
      const { query, json, ...init } = options;
      // Keep manager-only settings out of native fetch and injected transports.
      delete init.responseType;
      delete init.decode;
      delete init.timeoutMs;

      const method = options.method ?? HttpMethod.GET;

      if (json !== undefined && options.body != null) {
        throw new Error("Use either json or body, not both.");
      }

      if (
        (method === HttpMethod.GET || method === HttpMethod.HEAD) &&
        (json !== undefined || options.body != null)
      ) {
        throw new Error(`${method} requests cannot have a body.`);
      }

      const headers = Headers.merge(
        typeof defaults.headers === "function"
          ? defaults.headers()
          : defaults.headers,
        options.headers,
      );
      if (json !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      return {
        url: buildURL(path, defaults.baseURL, query),
        init: {
          ...init,
          method,
          headers,
          signal,
          cache: options.cache ?? defaults.cache ?? "no-store",
          ...(json !== undefined && { body: JSON.stringify(json) }),
        },
      };
    },
    {
      createException: (cause) =>
        cause instanceof HttpError
          ? cause
          : new HttpError(
              "Invalid HTTP request configuration.",
              "configuration",
              undefined,
              undefined,
              { cause },
            ),
    },
  );
}
