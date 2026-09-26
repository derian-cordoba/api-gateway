import { StatusCodes as HttpStatus } from "http-status-codes";
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
  constructor(private readonly config = getManagementConfig()) {}

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
    const url = this.buildURL(path, query);

    const response = await withErrorContext(
      () =>
        fetch(url, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${this.config.token}` },
          signal: AbortSignal.timeout(5_000),
        }),
      {
        createException: (cause) =>
          new GatewayManagementError(
            "Could not reach the gateway management API.",
            undefined,
            { cause },
          ),
      },
    );
    if (!response.ok) {
      throw new GatewayManagementError(
        response.status === HttpStatus.UNAUTHORIZED
          ? "The gateway management token was rejected."
          : "The gateway management API returned an error.",
        response.status,
      );
    }
    return await response.json();
  }

  private buildURL(path: string, query?: Record<string, string | number>): URL {
    const relativePath = path.replace(/^\/+/, "");
    const url = new URL(relativePath, this.config.baseUrl);

    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    return url;
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
