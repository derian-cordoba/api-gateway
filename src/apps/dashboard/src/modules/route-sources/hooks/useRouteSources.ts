"use client";

import { useCallback, useEffect, useState } from "react";
import { routeSourcesService, type SourcesResponse } from "../services/route-sources";

export function useRouteSources() {
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const refresh = useCallback(() => setGeneration((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const result = await routeSourcesService.list(controller.signal);
        if (!controller.signal.aborted) {
          setData(result);
          setError(null);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load route sources.");
        }
      } finally {
        if (!controller.signal.aborted) {
          timer = setTimeout(() => void load(), 5000);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [generation]);

  return { data, error, refresh };
}
