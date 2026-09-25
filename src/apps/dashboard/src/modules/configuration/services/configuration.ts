import type {
  GatewayRoute,
  StoredConfiguration,
  ValidationIssue,
} from "../types/configuration.types";
import { withErrorContext } from "@shared/errors/withErrorContext";
import { toError } from "@shared/errors/toError";

export type DashboardStatus = {
  status: string;
  storage?: string;
  routeCount?: number;
  revision?: string;
  updatedAt?: string | null;
  filePath?: string;
  message?: string;
};

export type ConfigurationHistoryEntry = { revision: string; updatedAt: string };

export type ConfigurationState = {
  configuration: StoredConfiguration | null;
  loading: boolean;
  saving: boolean;
  error: Error | null;
};

export type DashboardStatusState = {
  status: DashboardStatus | null;
  loading: boolean;
};

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

const initialConfigurationState: ConfigurationState = {
  configuration: null,
  loading: true,
  saving: false,
  error: null,
};

const initialStatusState: DashboardStatusState = {
  status: null,
  loading: true,
};

export class ConfigurationService {
  private configurationState = initialConfigurationState;
  private statusState = initialStatusState;
  private configurationListeners = new Set<() => void>();
  private statusListeners = new Set<() => void>();
  private configurationRequest: Promise<StoredConfiguration> | null = null;
  private statusRequest: Promise<DashboardStatus> | null = null;
  private configurationRequestId = 0;
  private statusRequestId = 0;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.configurationListeners.add(listener);
    void this.reload();
    return () => this.configurationListeners.delete(listener);
  };

  readonly getSnapshot = (): ConfigurationState => this.configurationState;

  readonly getServerSnapshot = (): ConfigurationState => initialConfigurationState;

  readonly subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    void this.refreshStatus();
    return () => this.statusListeners.delete(listener);
  };

  readonly getStatusSnapshot = (): DashboardStatusState => this.statusState;

  readonly getServerStatusSnapshot = (): DashboardStatusState => initialStatusState;

  readonly reload = async (force = true): Promise<StoredConfiguration | null> => {
    try {
      return await this.loadConfiguration(force);
    } catch {
      return null;
    }
  };

  readonly refreshStatus = async (force = true): Promise<DashboardStatus> => this.loadStatus(force);

  readonly save = async (routes: GatewayRoute[]): Promise<StoredConfiguration | null> => {
    const current = this.configurationState.configuration;
    if (!current) return null;

    this.setConfigurationState({ saving: true, error: null });
    try {
      const saved = await this.request<StoredConfiguration>("/api/config", {
        method: "PUT",
        body: JSON.stringify({ routes, expectedRevision: current.revision }),
      });
      this.setConfigurationState({ configuration: saved });
      return saved;
    } catch (caught) {
      const error = normalizeError(caught, "Could not save configuration.");
      this.setConfigurationState({ error });
      throw error;
    } finally {
      this.setConfigurationState({ saving: false });
    }
  };

  readonly validate = async (
    routes: GatewayRoute[],
  ): Promise<{
    success: true;
    warnings: Array<{ path: Array<string | number>; message: string }>;
  }> =>
    this.request("/api/config/validate", {
      method: "POST",
      body: JSON.stringify(routes),
    });

  readonly export = async (): Promise<void> => {
    try {
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
          const link = document.createElement("a");
          link.href = url;
          link.download = "routes.json";
          link.click();
          URL.revokeObjectURL(url);
        },
        {
          createException: (cause) =>
            cause instanceof DashboardApiError
              ? cause
              : new Error("Could not export configuration."),
        },
      );
    } catch (caught) {
      this.setConfigurationState({
        error: normalizeError(caught, "Could not export configuration."),
      });
    }
  };

  readonly history = async (): Promise<ConfigurationHistoryEntry[]> => {
    const payload = await this.request<{ entries: ConfigurationHistoryEntry[] }>(
      "/api/config/history",
    );
    return payload.entries;
  };

  readonly restore = async (revision: string): Promise<StoredConfiguration | null> => {
    const current = this.configurationState.configuration;
    if (!current) return null;
    const restored = await this.request<StoredConfiguration>("/api/config/history", {
      method: "POST",
      body: JSON.stringify({ revision, expectedRevision: current.revision }),
    });
    this.setConfigurationState({ configuration: restored });
    return restored;
  };

  readonly getDashboardToken = (): string => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("gateway-dashboard-token") ?? "";
  };

  readonly setDashboardToken = (token: string): void => {
    window.localStorage.setItem("gateway-dashboard-token", token.trim());
  };

  private async loadConfiguration(force = false): Promise<StoredConfiguration> {
    if (this.configurationRequest && !force) return this.configurationRequest;
    if (this.configurationState.configuration && !force) {
      return this.configurationState.configuration;
    }

    this.setConfigurationState({ loading: true, error: null });
    const requestId = ++this.configurationRequestId;
    this.configurationRequest = this.request<StoredConfiguration>("/api/config");

    try {
      const configuration = await this.configurationRequest;
      if (requestId === this.configurationRequestId) {
        this.setConfigurationState({ configuration });
      }
      return configuration;
    } catch (caught) {
      const error = normalizeError(caught, "Could not load configuration.");
      if (requestId === this.configurationRequestId) {
        this.setConfigurationState({ error });
      }
      throw error;
    } finally {
      if (requestId === this.configurationRequestId) {
        this.configurationRequest = null;
        this.setConfigurationState({ loading: false });
      }
    }
  }

  private async loadStatus(force = false): Promise<DashboardStatus> {
    if (this.statusRequest && !force) return this.statusRequest;
    if (this.statusState.status && !force) return this.statusState.status;

    this.setStatusState({ loading: true });
    const requestId = ++this.statusRequestId;
    this.statusRequest = this.request<DashboardStatus>("/api/status", {}, false);

    try {
      const status = await this.statusRequest;
      if (requestId === this.statusRequestId) this.setStatusState({ status });
      return status;
    } catch (caught) {
      const status = {
        status: "error",
        message: normalizeError(caught, "Could not load dashboard status.").message,
      };
      if (requestId === this.statusRequestId) this.setStatusState({ status });
      return status;
    } finally {
      if (requestId === this.statusRequestId) {
        this.statusRequest = null;
        this.setStatusState({ loading: false });
      }
    }
  }

  private async request<T>(path: string, init: RequestInit = {}, jsonRequest = true): Promise<T> {
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

  private getHeaders(jsonRequest: boolean): Record<string, string> {
    const token = this.getDashboardToken();
    return {
      ...(jsonRequest && { "Content-Type": "application/json" }),
      ...(token && { "X-Dashboard-Token": token }),
    };
  }

  private setConfigurationState(patch: Partial<ConfigurationState>): void {
    this.configurationState = { ...this.configurationState, ...patch };
    this.configurationListeners.forEach((listener) => listener());
  }

  private setStatusState(patch: Partial<DashboardStatusState>): void {
    this.statusState = { ...this.statusState, ...patch };
    this.statusListeners.forEach((listener) => listener());
  }
}

function normalizeError(caught: unknown, fallback: string): Error {
  const error = toError(caught);
  return caught instanceof Error ? error : new Error(fallback, { cause: error });
}

export const configurationService = new ConfigurationService();
