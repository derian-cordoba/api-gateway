"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useConfiguration } from "@/modules/configuration/hooks/useConfiguration";
import { createEmptyRoute } from "../tools/create-empty-route";
import { RouteDraftPage } from "../components/RouteDraftPage";

export function EditRoutePage() {
  const params = useSearchParams();
  const { configuration, loading, saving, error, reload, save } = useConfiguration();
  const indexParam = params.get("index");
  const index = indexParam === null ? null : Number(indexParam);
  const source = index !== null && configuration ? configuration.routes[index] : undefined;

  if (loading)
    return (
      <main className="page">
        <div className="editor-loading">
          <LoaderCircle className="spin" /> Loading route configuration…
        </div>
      </main>
    );
  if (error && !configuration)
    return (
      <main className="page">
        <div className="error-banner">
          <AlertCircle size={18} />
          <div>
            <strong>Configuration unavailable</strong>
            <p>{error.message}</p>
          </div>
          <button className="button button--quiet" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      </main>
    );
  if (index !== null && configuration && !source)
    return (
      <main className="page">
        <div className="empty-state">
          <h1>Route not found</h1>
          <p>The route may have been removed from the JSON file.</p>
          <Link className="button button--primary" href="/routes">
            Back to routes
          </Link>
        </div>
      </main>
    );
  if (!configuration) return null;

  return (
    <RouteDraftPage
      key={`${configuration.sourceId ?? "default"}:${configuration.revision}:${indexParam ?? "new"}`}
      configuration={configuration}
      index={index}
      initialRoute={source ? structuredClone(source) : createEmptyRoute()}
      saving={saving}
      save={save}
    />
  );
}
