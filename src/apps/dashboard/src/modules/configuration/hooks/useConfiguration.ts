"use client";

import { useSyncExternalStore } from "react";
import { configurationService } from "../services/configuration";

export function useConfiguration() {
  const state = useSyncExternalStore(
    configurationService.subscribe,
    configurationService.getSnapshot,
    configurationService.getServerSnapshot,
  );

  return {
    ...state,
    reload: configurationService.reload,
    save: (routes: Parameters<typeof configurationService.save>[0]) =>
      configurationService.save(routes, state.configuration),
    exportConfiguration: configurationService.export,
  };
}
