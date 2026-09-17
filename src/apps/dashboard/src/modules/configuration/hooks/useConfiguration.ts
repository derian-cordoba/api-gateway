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
    save: configurationService.save,
    exportConfiguration: configurationService.export,
  };
}
