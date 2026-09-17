"use client";

import { useSyncExternalStore } from "react";
import { configurationService } from "../services/configuration";

export function useDashboardStatus() {
  const state = useSyncExternalStore(
    configurationService.subscribeStatus,
    configurationService.getStatusSnapshot,
    configurationService.getServerStatusSnapshot,
  );

  return { ...state, refresh: configurationService.refreshStatus };
}
