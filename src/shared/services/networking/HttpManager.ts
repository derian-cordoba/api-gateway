import { HttpMethod } from "../../http/HttpMethod";
import { withErrorContext } from "../../errors/withErrorContext";
import { abortable } from "./abortable";
import { prepareRequest } from "./prepareRequest";
import { FetchHttpClient } from "./clients/FetchHttpClient";
import type {
  HttpManagerOptions,
  HttpRequestOptions,
  HttpTransport,
} from "./contracts";
import { HttpError } from "./HttpError";
import { readResponse } from "./readResponse";

const DEFAULT_TIMEOUT_MS = 15_000;

export class HttpManager {
  private readonly transport: HttpTransport;

  constructor(private readonly options: HttpManagerOptions = {}) {
    this.transport = options.transport ?? new FetchHttpClient();
  }

  async request<T = unknown>(
    path: string,
    options: HttpRequestOptions<T> = {},
  ): Promise<T> {
    const controller = new AbortController();
    const { signal } = controller;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", onAbort, { once: true });

    if (options.signal?.aborted) {
      onAbort();
    }

    try {
      return await withErrorContext(
        async () => {
          const timeoutMs =
            options.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
          if (
            !Number.isFinite(timeoutMs) ||
            timeoutMs < 0 ||
            timeoutMs > 2_147_483_647
          ) {
            throw new HttpError(
              "timeoutMs must be a finite, non-negative timer duration.",
              "configuration",
            );
          }

          if (timeoutMs > 0) {
            timer = setTimeout(() => {
              timedOut = true;
              controller.abort(new Error("HTTP request timed out."));
            }, timeoutMs);
          }

          const prepared = await prepareRequest(
            path,
            options,
            this.options,
            signal,
          );

          return abortable(async () => {
            signal.throwIfAborted();
            const response = await this.transport.send(
              prepared.url,
              prepared.init,
            );
            return readResponse(response, options);
          }, signal);
        },
        {
          createException: (cause) => {
            if (signal.aborted) {
              return new HttpError(
                timedOut
                  ? "HTTP request timed out."
                  : "HTTP request was cancelled.",
                timedOut ? "timeout" : "aborted",
                undefined,
                undefined,
                { cause },
              );
            }

            return cause instanceof HttpError
              ? cause
              : new HttpError(
                  "Could not reach the HTTP server.",
                  "network",
                  undefined,
                  undefined,
                  { cause },
                );
          },
        },
      );
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }

      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  get<T = unknown>(
    path: string,
    options: HttpRequestOptions<T> = {},
  ): Promise<T> {
    return this.request(path, { ...options, method: HttpMethod.GET });
  }

  post<T = unknown>(
    path: string,
    options: HttpRequestOptions<T> = {},
  ): Promise<T> {
    return this.request(path, { ...options, method: HttpMethod.POST });
  }

  put<T = unknown>(
    path: string,
    options: HttpRequestOptions<T> = {},
  ): Promise<T> {
    return this.request(path, { ...options, method: HttpMethod.PUT });
  }

  patch<T = unknown>(
    path: string,
    options: HttpRequestOptions<T> = {},
  ): Promise<T> {
    return this.request(path, { ...options, method: HttpMethod.PATCH });
  }

  delete<T = unknown>(
    path: string,
    options: HttpRequestOptions<T> = {},
  ): Promise<T> {
    return this.request(path, { ...options, method: HttpMethod.DELETE });
  }
}
