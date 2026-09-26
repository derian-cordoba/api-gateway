import { HttpMethod } from "@shared/http/HttpMethod";
import type { GatewayRoute, StoredConfiguration } from "../types/configuration.types";
import { toError } from "@shared/errors/toError";
import { DashboardApiClient } from "./dashboard-api-client";
export { DashboardApiError } from "./dashboard-api-client";

export type DashboardStatus = {
  status: string;
  storage?: string;
  environment?: string;
  configurationKey?: string;
  routeCount?: number;
  revision?: string;
  updatedAt?: string | null;
  filePath?: string;
  message?: string;
};

export type ConfigurationHistoryEntry = { revision: string; updatedAt: string };

export type ConfigurationState = {
  sourceId: string;
  configuration: StoredConfiguration | null;
  loading: boolean;
  saving: boolean;
  error: Error | null;
};

export type DashboardStatusState = {
  status: DashboardStatus | null;
  loading: boolean;
};

const initialConfigurationState: ConfigurationState = {
  sourceId: "default",
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
  private readonly client = new DashboardApiClient();
  private configurationState = initialConfigurationState;
  private statusState = initialStatusState;
  private configurationListeners = new Set<() => void>();
  private statusListeners = new Set<() => void>();
  private configurationRequest: Promise<StoredConfiguration> | null = null;
  private statusRequest: Promise<DashboardStatus> | null = null;
  private historyRequest: Promise<ConfigurationHistoryEntry[]> | null = null;
  private configurationRequestId = 0;
  private statusRequestId = 0;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.configurationListeners.add(listener);
    void this.reload(false);
    return () => this.configurationListeners.delete(listener);
  };

  readonly getSnapshot = (): ConfigurationState => this.configurationState;

  readonly getServerSnapshot = (): ConfigurationState => initialConfigurationState;

  readonly subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    void this.refreshStatus(false);
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

  readonly selectSource = (sourceId: string): void => {
    if (this.configurationState.saving) {
      throw new Error("Wait for the current save to finish before switching sources.");
    }

    if (sourceId === this.configurationState.sourceId) {
      return;
    }

    ++this.configurationRequestId;
    ++this.statusRequestId;

    this.configurationRequest = null;
    this.statusRequest = null;
    this.historyRequest = null;

    this.setConfigurationState({ ...initialConfigurationState, sourceId });
    this.setStatusState(initialStatusState);

    void this.reload();
    void this.refreshStatus();
  };

  readonly save = async (
    routes: GatewayRoute[],
    expected = this.configurationState.configuration,
  ): Promise<StoredConfiguration | null> => {
    if (!expected) {
      return null;
    }

    const sourceId = this.configurationState.sourceId;
    if ((expected.sourceId ?? "default") !== sourceId) {
      throw new Error("The selected source changed. Reload before saving.");
    }

    this.setConfigurationState({ saving: true, error: null });
    try {
      const saved = await this.client.request<StoredConfiguration>(
        this.path("/api/config", sourceId),
        {
          method: HttpMethod.PUT,
          json: { routes, expectedRevision: expected.revision },
        },
      );
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
    this.client.request("/api/config/validate", {
      method: HttpMethod.POST,
      json: routes,
    });

  readonly export = async (): Promise<void> => {
    try {
      await this.client.downloadConfiguration(
        this.path("/api/config/export"),
      );
    } catch (caught) {
      this.setConfigurationState({
        error: normalizeError(caught, "Could not export configuration."),
      });
    }
  };

  readonly history = async (): Promise<ConfigurationHistoryEntry[]> => {
    if (this.historyRequest) return this.historyRequest;
    this.historyRequest = (async () => {
      const payload = await this.client.request<{ entries: ConfigurationHistoryEntry[] }>(
        this.path("/api/config/history"),
      );
      return payload.entries;
    })();
    const pending = this.historyRequest;
    try {
      return await pending;
    } finally {
      if (this.historyRequest === pending) {
        this.historyRequest = null;
      }
    }
  };

  readonly restore = async (revision: string): Promise<StoredConfiguration | null> => {
    const current = this.configurationState.configuration;
    if (!current) return null;
    this.setConfigurationState({ saving: true, error: null });
    try {
      const restored = await this.client.request<StoredConfiguration>(
        this.path("/api/config/history"),
        {
          method: HttpMethod.POST,
          json: { revision, expectedRevision: current.revision },
        },
      );
      this.setConfigurationState({ configuration: restored });
      return restored;
    } finally {
      this.setConfigurationState({ saving: false });
    }
  };

  readonly getDashboardToken = (): string => this.client.getDashboardToken();

  readonly setDashboardToken = (token: string): void => this.client.setDashboardToken(token);

  private async loadConfiguration(force = false): Promise<StoredConfiguration> {
    if (this.configurationRequest && !force) return this.configurationRequest;
    if (this.configurationState.configuration && !force) {
      return this.configurationState.configuration;
    }

    this.setConfigurationState({ loading: true, error: null });
    const requestId = ++this.configurationRequestId;
    this.configurationRequest = this.client.request<StoredConfiguration>(
      this.path("/api/config"),
    );

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
    this.statusRequest = this.client.request<DashboardStatus>(
      this.path("/api/status"),
      {},
      false,
    );

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

  private path(path: string, sourceId = this.configurationState.sourceId): string {
    return sourceId === "default"
      ? path
      : `${path}?source=${encodeURIComponent(sourceId)}`;
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
