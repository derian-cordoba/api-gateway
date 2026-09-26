import { withErrorContext } from "@shared/errors/withErrorContext";
import {
  Headers,
  HttpError,
  HttpManager,
  type HttpRequestOptions,
} from "@shared/services/networking";
import { isRecord } from "@shared/guards/isRecord";
import type { ValidationIssue } from "../types/configuration.types";

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: ValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DashboardApiError";
  }
}

export class DashboardApiClient {
  constructor(private readonly http = new HttpManager()) { }

  getDashboardToken(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("gateway-dashboard-token") ?? "";
  }

  setDashboardToken(token: string): void {
    window.localStorage.setItem("gateway-dashboard-token", token.trim());
  }

  async request<T>(path: string, init: HttpRequestOptions<T> = {}, jsonRequest = true): Promise<T> {
    return withErrorContext(
      async () => {
        const headers = Headers.merge(this.getHeaders(jsonRequest), init.headers);
        return this.http.request<T>(path, { ...init, headers });
      },
      {
        createException: (cause) => this.toApiError(cause, `Dashboard request to ${path} failed.`),
      },
    );
  }

  async downloadConfiguration(): Promise<void> {
    await withErrorContext(
      async () => {
        const blob = await this.http.get<Blob>("/api/config/export", {
          headers: this.getHeaders(false),
          responseType: "blob",
        });
        const url = URL.createObjectURL(blob);
        try {
          const link = document.createElement("a");
          link.href = url;
          link.download = "routes.json";
          link.click();
        } finally {
          URL.revokeObjectURL(url);
        }
      },
      {
        createException: (cause) => this.toApiError(cause, "Could not export configuration."),
      },
    );
  }

  private toApiError(cause: unknown, fallback: string): Error {
    if (cause instanceof DashboardApiError) {
      return cause;
    }

    if (cause instanceof HttpError && cause.kind === "http" && cause.status !== undefined) {
      const payload = cause.payload;
      const issues =
        isRecord(payload) && Array.isArray(payload.issues)
          ? payload.issues.filter(
            (issue): issue is ValidationIssue =>
              isRecord(issue) &&
              typeof issue.message === "string" &&
              Array.isArray(issue.path) &&
              issue.path.every((part) => typeof part === "string" || typeof part === "number"),
          )
          : [];
      return new DashboardApiError(cause.message, cause.status, issues, { cause });
    }

    return new Error(fallback, { cause });
  }

  private getHeaders(jsonRequest: boolean): Record<string, string> {
    const token = this.getDashboardToken();
    return {
      ...(jsonRequest && { "Content-Type": "application/json" }),
      ...(token && { "X-Dashboard-Token": token }),
    };
  }
}
