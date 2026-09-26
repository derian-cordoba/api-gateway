import type {
  GatewayEvents,
  GatewayOverview,
} from "@/server/gateway/contracts";
import { isRecord } from "@shared/guards/isRecord";
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

class ObservatoryApiService {
  async getOverview(): Promise<GatewayOverview> {
    return this.get<GatewayOverview>(
      "/api/gateway/overview",
      "Could not load gateway status.",
    );
  }

  async getEvents(limit: number): Promise<GatewayEvents> {
    if (!isValidEventLimit(limit)) {
      throw new ObservatoryApiError(
        "The events limit must be an integer between 1 and 100.",
      );
    }

    const query = new URLSearchParams({ limit: String(limit) });
    return this.get<GatewayEvents>(
      `/api/gateway/events?${query.toString()}`,
      "Could not load gateway events.",
    );
  }

  private async get<T>(path: string, fallbackMessage: string): Promise<T> {
    const response = await withErrorContext(
      () => fetch(path, { cache: "no-store" }),
      {
        createException: (cause) =>
          new ObservatoryApiError(fallbackMessage, undefined, { cause }),
      },
    );

    const payload = await withErrorContext(() => response.json(), {
      createException: (cause) =>
        new ObservatoryApiError(
          response.ok
            ? "The Observatory API returned invalid JSON."
            : fallbackMessage,
          response.status,
          { cause },
        ),
    });

    if (!response.ok) {
      throw new ObservatoryApiError(
        getErrorMessage(payload) ?? fallbackMessage,
        response.status,
      );
    }

    return payload as T;
  }
}

function getErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;

  if (typeof payload.message === "string") return payload.message;
  return typeof payload.error === "string" ? payload.error : undefined;
}

export const observatoryApi = new ObservatoryApiService();
