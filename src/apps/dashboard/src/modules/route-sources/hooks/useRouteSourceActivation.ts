"use client";

import { useState } from "react";
import {
  routeSourcesService,
  type SourceHealth,
  type SourceRuntimeStatus,
} from "../services/route-sources";

export function useRouteSourceActivation(onActivated: () => void) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = async (health: SourceHealth, runtime: SourceRuntimeStatus): Promise<boolean> => {
    setActivating(true);
    setError(null);

    try {
      await routeSourcesService.activate(
        health.sourceId,
        runtime.desired.version,
        health.revision,
      );

      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activation failed.");
      return false;
    } finally {
      setActivating(false);
      onActivated();
    }
  };

  return { activating, error, activate };
}
