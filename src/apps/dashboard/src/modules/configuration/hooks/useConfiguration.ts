"use client";

import { useCallback, useEffect, useState } from "react";
import { getConfiguration, saveConfiguration } from "../tools/configuration-api";
import type { GatewayRoute, StoredConfiguration } from "../types/configuration.types";

export function useConfiguration() {
  const [configuration, setConfiguration] = useState<StoredConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConfiguration(await getConfiguration());
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Could not load configuration."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (routes: GatewayRoute[]) => {
      if (!configuration) return null;
      setSaving(true);
      setError(null);
      try {
        const saved = await saveConfiguration(routes, configuration.revision);
        setConfiguration(saved);
        return saved;
      } catch (caught) {
        const normalized = caught instanceof Error ? caught : new Error("Could not save configuration.");
        setError(normalized);
        throw normalized;
      } finally {
        setSaving(false);
      }
    },
    [configuration],
  );

  return { configuration, loading, saving, error, reload, save };
}

