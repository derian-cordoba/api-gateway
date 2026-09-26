import type { HttpManagerOptions } from "./contracts";
import { MockHttpClient, type MockRoute } from "./clients/MockHttpClient";
import { HttpManager } from "./HttpManager";

export type HttpManagerConfig = Omit<HttpManagerOptions, "transport"> &
  ({ mode?: "live" } | { mode: "mock"; routes: readonly MockRoute[] });

/** Mode is chosen once at the composition boundary, never from URL input. */
export function createHttpManager(config: HttpManagerConfig = {}): HttpManager {
  return new HttpManager({
    ...config,
    transport:
      config.mode === "mock" ? new MockHttpClient(config.routes) : undefined,
  });
}
