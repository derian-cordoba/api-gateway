"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, Download, Plus, RefreshCw, Route as RouteIcon, Search } from "lucide-react";
import { useConfiguration } from "@/modules/configuration/hooks/useConfiguration";
import { RouteCard } from "../components/RouteCard";
import { useRouteTools } from "../hooks/useRouteTools";

export function RoutesPage() {
  const { configuration, loading, saving, error, reload, save, exportConfiguration } =
    useConfiguration();
  const [query, setQuery] = useState("");
  const routes = useMemo(() => configuration?.routes ?? [], [configuration?.routes]);
  const filtered = useMemo(
    () =>
      routes
        .map((route, index) => ({ route, index }))
        .filter(({ route }) =>
          `${route.baseURL} ${route.proxy.target ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ),
    [query, routes],
  );
  useRouteTools(routes, save);

  const duplicate = async (index: number) => {
    const source = routes[index];
    const copy = structuredClone(source);
    copy.baseURL = `${source.baseURL.replace(/\/$/, "")}-copy`;
    await save([...routes.slice(0, index + 1), copy, ...routes.slice(index + 1)]).catch(
      () => undefined,
    );
  };

  const remove = async (index: number) => {
    if (!window.confirm(`Delete ${routes[index].baseURL}? This applies immediately.`)) return;
    await save(routes.filter((_, routeIndex) => routeIndex !== index)).catch(() => undefined);
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Routing table</span>
          <h1>Routes</h1>
          <p>Configure upstreams and route-level gateway behavior.</p>
        </div>
        <div className="page-actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={() => void exportConfiguration()}
          >
            <Download size={17} /> Export
          </button>
          <button className="button button--quiet" type="button" onClick={() => void reload()}>
            <RefreshCw size={17} /> Refresh
          </button>
          <Link className="button button--primary" href="/routes/edit">
            <Plus size={17} /> New route
          </Link>
        </div>
      </header>

      {configuration && (
        <div className="status-strip">
          <span>
            <i className="status-dot" /> Local JSON active
          </span>
          <span>{configuration.routes.length} routes</span>
          <span>
            Revision <code>{configuration.revision}</code>
          </span>
          {saving ? <span>Applying changes…</span> : null}
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <div>
            <strong>Configuration unavailable</strong>
            <p>{error.message}</p>
          </div>
          <button className="button button--quiet button--small" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      )}

      <div className="toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search routes or upstreams"
            aria-label="Search routes"
          />
        </label>
      </div>

      {loading ? (
        <div className="route-list">
          {[0, 1, 2].map((item) => (
            <div className="skeleton-card" key={item} />
          ))}
        </div>
      ) : null}
      {!loading && routes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <RouteIcon size={28} />
          </div>
          <h2>No routes configured</h2>
          <p>Create the first route to start forwarding gateway traffic.</p>
          <Link className="button button--primary" href="/routes/edit">
            <Plus size={17} /> Create route
          </Link>
        </div>
      ) : null}
      {!loading && routes.length > 0 ? (
        <div className="route-list">
          {filtered.map(({ route, index }) => (
            <RouteCard
              key={`${route.baseURL}-${index}`}
              route={route}
              index={index}
              onDuplicate={() => void duplicate(index)}
              onDelete={() => void remove(index)}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}
