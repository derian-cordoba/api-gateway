import { withErrorContext } from "@shared/errors/withErrorContext";
import type { ValidationIssue } from "../types/configuration.types";

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = "DashboardApiError";
  }
}

export class DashboardApiClient {
  getDashboardToken(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("gateway-dashboard-token") ?? "";
  }

  setDashboardToken(token: string): void {
    window.localStorage.setItem("gateway-dashboard-token", token.trim());
  }

  async request<T>(path: string, init: RequestInit = {}, jsonRequest = true): Promise<T> {
    return withErrorContext(
      async () => {
        const response = await fetch(path, {
          ...init,
          cache: "no-store",
          headers: {
            ...this.getHeaders(jsonRequest),
            ...init.headers,
          },
        });
        const payload = (await response.json()) as T & {
          message?: string;
          error?: string;
          issues?: ValidationIssue[];
        };
        if (!response.ok) {
          throw new DashboardApiError(
            payload.message ?? payload.error ?? "Dashboard request failed.",
            response.status,
            payload.issues,
          );
        }
        return payload;
      },
      {
        createException: (cause) =>
          cause instanceof DashboardApiError
            ? cause
            : new Error(`Dashboard request to ${path} failed.`),
      },
    );
  }

  async downloadConfiguration(): Promise<void> {
    await withErrorContext(
      async () => {
        const response = await fetch("/api/config/export", {
          cache: "no-store",
          headers: this.getHeaders(false),
        });
        if (!response.ok) {
          throw new DashboardApiError("Could not export configuration.", response.status);
        }

        const url = URL.createObjectURL(await response.blob());
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
        createException: (cause) =>
          cause instanceof DashboardApiError ? cause : new Error("Could not export configuration."),
      },
    );
  }

  private getHeaders(jsonRequest: boolean): Record<string, string> {
    const token = this.getDashboardToken();
    return {
      ...(jsonRequest && { "Content-Type": "application/json" }),
      ...(token && { "X-Dashboard-Token": token }),
    };
  }
}
