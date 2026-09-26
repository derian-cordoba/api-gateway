"use client";

import { useEffect, useState } from "react";
import { configurationService, type ConfigurationHistoryEntry } from "../services/configuration";
import { useConfiguration } from "./useConfiguration";

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function useConfigurationHistory() {
  const {
    configuration,
    sourceId,
    loading: configurationLoading,
    error: configurationError,
    reload: reloadConfiguration,
  } = useConfiguration();

  const [history, setHistory] = useState<ConfigurationHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadInitialHistory() {
      try {
        const entries = await configurationService.history();
        if (active) {
          setHistory(entries);
        }
      } catch (caught) {
        if (active) {
          setError(errorMessage(caught, "Could not load configuration history."));
        }
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void loadInitialHistory();

    return () => {
      active = false;
    };
  }, [sourceId]);

  const refreshHistory = async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const entries = await configurationService.history();
      setHistory(entries);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught, "Could not load configuration history."));
    } finally {
      setHistoryLoading(false);
    }
  };

  const restore = async (revision: string) => {
    if (!configuration || !window.confirm(`Restore configuration revision ${revision}?`)) {
      return;
    }

    setRestoring(revision);
    setError(null);

    try {
      const restored = await configurationService.restore(revision);
      if (!restored) throw new Error("Configuration is not ready to restore.");
      await refreshHistory();
    } catch (caught) {
      setError(errorMessage(caught, "Could not restore configuration."));
    } finally {
      setRestoring(null);
    }
  };

  return {
    history,
    historyLoading,
    error,
    restoring,
    configurationError,
    canRestore: !configurationLoading && !!configuration && !configurationError,
    refreshHistory,
    reloadConfiguration,
    restore,
  };
}
