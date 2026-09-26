"use client";

import { SelectedRouteSource } from "@/modules/route-sources/components/SelectedRouteSource";

import { useMemo, useState } from "react";
import { useConfiguration } from "@/modules/configuration/hooks/useConfiguration";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { RoutesList } from "../components/RoutesList";
import { RoutesHeader } from "../components/RoutesHeader";
import { RoutesStatusStrip } from "../components/RoutesStatusStrip";
import { RoutesErrorBanner } from "../components/RoutesErrorBanner";
import { RouteSearchField } from "../components/RouteSearchField";
import { useRouteTools } from "../hooks/useRouteTools";

const EMPTY_ROUTES: GatewayRoute[] = [];

export function RoutesPage() {
  const { configuration, loading, saving, error, reload, save, exportConfiguration } =
    useConfiguration();
  const [query, setQuery] = useState("");
  const routes = configuration?.routes ?? EMPTY_ROUTES;
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return routes
      .map((route, index) => ({ route, index }))
      .filter(({ route }) =>
        `${route.baseURL} ${route.proxy.target ?? ""} ${route.proxy.targets?.map((target) => target.url).join(" ") ?? ""}`
          .toLowerCase()
          .includes(search),
      );
  }, [query, routes]);
  useRouteTools(routes, save);

  const duplicate = async (index: number) => {
    const source = routes[index];
    const copy = structuredClone(source);
    copy.baseURL = `${source.baseURL.replace(/\/$/, "")}-copy`;
    try {
      await save([...routes.slice(0, index + 1), copy, ...routes.slice(index + 1)]);
    } catch {
      // useConfiguration exposes the save error in the banner below.
    }
  };

  const remove = async (index: number) => {
    if (!window.confirm(`Delete ${routes[index].baseURL}? This applies immediately.`)) return;
    try {
      await save(routes.filter((_, routeIndex) => routeIndex !== index));
    } catch {
      // useConfiguration exposes the save error in the banner below.
    }
  };

  return (
    <main className="page">
      <SelectedRouteSource />
      <RoutesHeader onExport={() => void exportConfiguration()} onRefresh={() => void reload()} />
      {configuration && <RoutesStatusStrip configuration={configuration} saving={saving} />}
      {error && <RoutesErrorBanner error={error} onRetry={() => void reload()} />}
      <RouteSearchField value={query} onChange={setQuery} />

      <RoutesList
        routes={routes}
        filtered={filtered}
        loading={loading}
        onDuplicate={(index) => void duplicate(index)}
        onDelete={(index) => void remove(index)}
      />
    </main>
  );
}
