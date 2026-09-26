// @vitest-environment jsdom

import { HttpMethod } from "@shared/http/HttpMethod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigurationService,
  DashboardApiError,
} from "@/modules/configuration/services/configuration";
import type { StoredConfiguration } from "@/modules/configuration/types/configuration.types";

const configuration: StoredConfiguration = {
  routes: [{ baseURL: "/products", proxy: { target: "http://localhost:4100" } }],
  revision: "revision-1",
  updatedAt: "2026-09-17T00:00:00.000Z",
  filePath: "/tmp/routes.json",
  warnings: [],
};

describe("ConfigurationService", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    installLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads configuration and publishes the resulting state", async () => {
    fetchMock.mockResolvedValue(jsonResponse(configuration));
    const service = new ConfigurationService();
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    await vi.waitFor(() => expect(service.getSnapshot().loading).toBe(false));

    expect(service.getSnapshot()).toMatchObject({
      configuration,
      loading: false,
      error: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/config",
      expect.objectContaining({
        cache: "no-store",
        headers: new Headers({ "Content-Type": "application/json" }),
      }),
    );
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("reuses an in-flight configuration request", async () => {
    let resolveRequest!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const service = new ConfigurationService();

    const first = service.reload(false);
    const second = service.reload(false);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveRequest(jsonResponse(configuration));
    await expect(Promise.all([first, second])).resolves.toEqual([configuration, configuration]);
  });

  it("shares an initial load across subscribers", async () => {
    let resolveRequest!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const service = new ConfigurationService();
    const unsubscribeFirst = service.subscribe(vi.fn());
    const unsubscribeSecond = service.subscribe(vi.fn());

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveRequest(jsonResponse(configuration));
    await vi.waitFor(() => expect(service.getSnapshot().loading).toBe(false));
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it("shares an in-flight history request", async () => {
    let resolveRequest!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const service = new ConfigurationService();
    const first = service.history();
    const second = service.history();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveRequest(jsonResponse({ entries: [{ revision: "previous", updatedAt: "2026-09-17" }] }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      [{ revision: "previous", updatedAt: "2026-09-17" }],
      [{ revision: "previous", updatedAt: "2026-09-17" }],
    ]);
  });

  it("saves routes with the current revision and dashboard token", async () => {
    const saved = { ...configuration, revision: "revision-2" };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(configuration))
      .mockResolvedValueOnce(jsonResponse(saved));
    const service = new ConfigurationService();
    service.setDashboardToken("  dashboard-secret  ");
    await service.reload();

    const result = await service.save(configuration.routes);

    expect(result).toEqual(saved);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/config",
      expect.objectContaining({
        method: HttpMethod.PUT,
        body: JSON.stringify({
          routes: configuration.routes,
          expectedRevision: configuration.revision,
        }),
        cache: "no-store",
        headers: new Headers({
          "Content-Type": "application/json",
          "X-Dashboard-Token": "dashboard-secret",
        }),
      }),
    );
    expect(service.getSnapshot()).toMatchObject({ configuration: saved, saving: false });
  });

  it("stores structured API errors in configuration state", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          message: "Route validation failed.",
          issues: [{ path: [0, "baseURL"], message: "Required" }],
        },
        422,
      ),
    );
    const service = new ConfigurationService();

    await expect(service.reload()).resolves.toBeNull();

    expect(service.getSnapshot().error).toBeInstanceOf(DashboardApiError);
    expect(service.getSnapshot().error).toMatchObject({
      status: 422,
      issues: [{ path: [0, "baseURL"], message: "Required" }],
    });
  });

  it("adds endpoint context to transport failures", async () => {
    const cause = new TypeError("Failed to fetch");
    fetchMock.mockRejectedValue(cause);
    const service = new ConfigurationService();

    await expect(service.reload()).resolves.toBeNull();

    expect(service.getSnapshot().error).toMatchObject({
      message: "Dashboard request to /api/config failed.",
      cause: { kind: "network", cause },
    });
  });

  it("maps status request failures to a displayable status", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: "A valid dashboard token is required." }, 401),
    );
    const service = new ConfigurationService();

    await expect(service.refreshStatus()).resolves.toEqual({
      status: "error",
      message: "A valid dashboard token is required.",
    });
    expect(service.getStatusSnapshot()).toEqual({
      status: {
        status: "error",
        message: "A valid dashboard token is required.",
      },
      loading: false,
    });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function installLocalStorage(): void {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage,
  });
}
