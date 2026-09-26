import { StatusCodes as HttpStatus } from "http-status-codes";
import { HttpError, HttpManager } from "@shared/services/networking";
import { withErrorContext } from "@shared/errors/withErrorContext";
import {
  DEFAULT_EVENT_LIMIT,
  isValidEventLimit,
} from "@/modules/overview/event-limit";
import type { GatewayEvents, GatewayOverview } from "./contracts";

type ManagementConfig = { baseUrl: URL; token: string };

export class GatewayManagementError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GatewayManagementError";
  }
}

export class GatewayManagementClient {
  private readonly http: HttpManager;

  constructor(config = getManagementConfig(), http?: HttpManager) {
    this.http =
      http ??
      new HttpManager({
        baseURL: config.baseUrl.toString(),
        headers: { Authorization: `Bearer ${config.token}` },
        timeoutMs: 5_000,
      });
  }

  async overview(): Promise<GatewayOverview> {
    return this.get<GatewayOverview>("/v1/overview");
  }

  async events(limit = DEFAULT_EVENT_LIMIT): Promise<GatewayEvents> {
    if (!isValidEventLimit(limit)) {
      throw new GatewayManagementError(
        "The events limit must be an integer between 1 and 100.",
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.get<GatewayEvents>("/v1/events", { limit });
  }

  private async get<T>(
    path: string,
    query?: Record<string, string | number>,
  ): Promise<T> {
    return withErrorContext(() => this.http.get<T>(path, { query }), {
      createException: (cause) => {
        const error = cause instanceof HttpError ? cause : undefined;
        return new GatewayManagementError(
          error?.status === HttpStatus.UNAUTHORIZED
            ? "The gateway management token was rejected."
            : error?.kind === "http"
              ? "The gateway management API returned an error."
              : "Could not reach the gateway management API.",
          error?.status,
          { cause },
        );
      },
    });
  }
}

function getManagementConfig(): ManagementConfig {
  const rawUrl = process.env.GATEWAY_MANAGEMENT_URL;
  const token = process.env.GATEWAY_MANAGEMENT_TOKEN?.trim();
  if (!rawUrl || !token) {
    throw new GatewayManagementError(
      "GATEWAY_MANAGEMENT_URL and GATEWAY_MANAGEMENT_TOKEN must be configured on the Observatory server.",
    );
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawUrl.endsWith("/") ? rawUrl : `${rawUrl}/`);
  } catch (cause) {
    throw new GatewayManagementError(
      "GATEWAY_MANAGEMENT_URL must be an absolute URL.",
      undefined,
      { cause },
    );
  }
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new GatewayManagementError(
      "GATEWAY_MANAGEMENT_URL must use HTTP or HTTPS.",
    );
  }
  return { baseUrl, token };
}
