"use client";

import { useEffect, useState } from "react";
import { routeSourcesService, type SourceHealth } from "../services/route-sources";

export function useRouteSourceHealth(sourceId: string) {
  const [health, setHealth] = useState<SourceHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(<boolean>false);
  const [generation, setGeneration] = useState<number>(0);

  useEffect(() => {
    const controller = new AbortController();

    async function check() {
      setLoading(true);
      setHealth(null);
      setError(null);

      try {
        const result = await routeSourcesService.check(sourceId, controller.signal);
        if (!controller.signal.aborted) {
          setHealth(result);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Source check failed.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void check();

    return () => controller.abort();
  }, [sourceId, generation]);

  return { health, error, loading, check: () => setGeneration((value) => value + 1) };
}
