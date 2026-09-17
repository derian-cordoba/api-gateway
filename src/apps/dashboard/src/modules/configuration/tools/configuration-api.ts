import type {
  GatewayRoute,
  StoredConfiguration,
  ValidationIssue,
} from "../types/configuration.types";

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

export async function getConfiguration(): Promise<StoredConfiguration> {
  return request<StoredConfiguration>("/api/config");
}

export async function saveConfiguration(
  routes: GatewayRoute[],
  expectedRevision: string,
): Promise<StoredConfiguration> {
  return request<StoredConfiguration>("/api/config", {
    method: "PUT",
    body: JSON.stringify({ routes, expectedRevision }),
  });
}

export async function validateConfiguration(
  routes: GatewayRoute[],
): Promise<{ success: true; warnings: Array<{ path: Array<string | number>; message: string }> }> {
  return request("/api/config/validate", {
    method: "POST",
    body: JSON.stringify(routes),
  });
}

export async function exportConfiguration(): Promise<void> {
  const token = getDashboardToken();
  const response = await fetch("/api/config/export", {
    cache: "no-store",
    headers: token ? { "X-Dashboard-Token": token } : {},
  });
  if (!response.ok) throw new DashboardApiError("Could not export configuration.", response.status);

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "routes.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function getDashboardToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("gateway-dashboard-token") ?? "";
}

export function setDashboardToken(token: string): void {
  window.localStorage.setItem("gateway-dashboard-token", token.trim());
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getDashboardToken();
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Dashboard-Token": token } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json()) as {
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

  return payload as T;
}
