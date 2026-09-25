"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  GatewayRoute,
  StoredConfiguration,
} from "@/modules/configuration/types/configuration.types";
import type { useConfiguration } from "@/modules/configuration/hooks/useConfiguration";

export function useRouteDraft({
  configuration,
  index,
  initialRoute,
  save,
}: {
  configuration: StoredConfiguration;
  index: number | null;
  initialRoute: GatewayRoute;
  save: ReturnType<typeof useConfiguration>["save"];
}) {
  const router = useRouter();
  const [route, setRoute] = useState(initialRoute);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const enabledSections = new Set(
    [
      "proxy",
      route.validation && "validation",
      route.webhook && "webhook",
      route.auth && "authentication",
      route.rateLimit && "rateLimit",
      route.circuitBreaker && "circuitBreaker",
      route.retry && "retry",
      route.cache && "cache",
      route.ipFilter && "ipFilter",
      route.headers && "headers",
      route.cors && "cors",
    ].filter((section): section is string => typeof section === "string"),
  );

  const submit = async () => {
    setSaveError(null);
    const routes = [...configuration.routes];
    if (index === null) {
      routes.push(route);
    } else {
      routes[index] = route;
    }

    try {
      const saved = await save(routes);
      if (saved) {
        router.push("/routes");
      } else {
        setSaveError(new Error("Configuration is not ready to save."));
      }
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught : new Error("Could not save route."));
    }
  };

  return { route, setRoute, saveError, enabledSections, submit };
}
