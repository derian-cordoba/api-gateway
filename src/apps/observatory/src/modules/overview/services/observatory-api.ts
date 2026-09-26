import type {
  GatewayEvents,
  GatewayOverview,
} from "@/server/gateway/contracts";
import {
  HttpError,
  HttpManager,
  type HttpRequestOptions,
} from "@shared/services/networking";
import { withErrorContext } from "@shared/errors/withErrorContext";
import { isValidEventLimit } from "../event-limit";

export class ObservatoryApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ObservatoryApiError";
  }
}

export class ObservatoryApiService {
  constructor(private readonly http = new HttpManager()) {}

  async getOverview(signal?: AbortSignal): Promise<GatewayOverview> {
    return this.get<GatewayOverview>(
      "/api/gateway/overview",
      "Could not load gateway status.",
      { signal },
    );
  }

  async getEvents(limit: number, signal?: AbortSignal): Promise<GatewayEvents> {
    if (!isValidEventLimit(limit)) {
      throw new ObservatoryApiError(
        "The events limit must be an integer between 1 and 100.",
      );
    }

    return this.get<GatewayEvents>(
      "/api/gateway/events",
      "Could not load gateway events.",
      { query: { limit }, signal },
    );
  }

  private async get<T>(
    path: string,
    fallbackMessage: string,
    options: HttpRequestOptions<T> = {},
  ): Promise<T> {
    return withErrorContext(() => this.http.get<T>(path, options), {
      createException: (cause) => {
        const error = cause instanceof HttpError ? cause : undefined;
        const message =
          error?.kind === "http"
            ? error.message
            : error?.kind === "decode"
              ? "The Observatory API returned invalid JSON."
              : fallbackMessage;
        return new ObservatoryApiError(message, error?.status, { cause });
      },
    });
  }
}

export const observatoryApi = new ObservatoryApiService();
