import { StatusCodes as HttpStatus } from "http-status-codes";
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

  async events(): Promise<GatewayEvents> {
    return this.get<GatewayEvents>("/v1/events?limit=50");
  }

  private async get<T>(path: string): Promise<T> {
    const relativePath = path.replace(/^\/+/, "");
    const url = new URL(relativePath, this.config.baseUrl);
    let response: Response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${this.config.token}` },
        signal: AbortSignal.timeout(5_000),
      });
    } catch (cause) {
      throw new GatewayManagementError(
        "Could not reach the gateway management API.",
        undefined,
        { cause },
      );
    }
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
