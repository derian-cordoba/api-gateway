"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Check, LoaderCircle } from "lucide-react";
import { useConfiguration } from "@/modules/configuration/hooks/useConfiguration";
import { DashboardApiError } from "@/modules/configuration/tools/configuration-api";
import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";
import { createEmptyRoute } from "../tools/create-empty-route";
import { RouteEditor } from "../components/RouteEditor";

const sections = [
  ["proxy", "Upstream"], ["authentication", "Authentication"], ["rateLimit", "Rate limiting"],
  ["circuitBreaker", "Circuit breaker"], ["retry", "Retries"], ["cache", "Response cache"],
  ["ipFilter", "IP filtering"], ["headers", "Header transforms"], ["cors", "CORS"],
] as const;

export function EditRoutePage() {
  const params = useSearchParams();
  const router = useRouter();
  const { configuration, loading, saving, error, reload, save } = useConfiguration();
  const indexParam = params.get("index");
  const index = indexParam === null ? null : Number(indexParam);
  const source = index !== null && configuration ? configuration.routes[index] : undefined;
  const [route, setRoute] = useState<GatewayRoute>(() => createEmptyRoute());
  const [initializedKey, setInitializedKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);

  useEffect(() => {
    if (!configuration) return;
    const key = `${configuration.revision}:${indexParam ?? "new"}`;
    if (initializedKey === key) return;
    setRoute(source ? structuredClone(source) : createEmptyRoute());
    setInitializedKey(key);
  }, [configuration, indexParam, initializedKey, source]);

  const enabledSections = useMemo(() => new Set([
    "proxy",
    route.auth && "authentication",
    route.rateLimit && "rateLimit",
    route.circuitBreaker && "circuitBreaker",
    route.retry && "retry",
    route.cache && "cache",
    route.ipFilter && "ipFilter",
    route.headers && "headers",
    route.cors && "cors",
  ].filter(Boolean)), [route]);

  const submit = async () => {
    if (!configuration) return;
    setSaveError(null);
    const routes = [...configuration.routes];
    if (index === null) routes.push(route);
    else routes[index] = route;
    try {
      await save(routes);
      router.push("/routes");
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught : new Error("Could not save route."));
    }
  };

  if (loading) return <main className="page"><div className="editor-loading"><LoaderCircle className="spin" /> Loading route configuration…</div></main>;
  if (error && !configuration) return <main className="page"><div className="error-banner"><AlertCircle size={18} /><div><strong>Configuration unavailable</strong><p>{error.message}</p></div><button className="button button--quiet" onClick={() => void reload()}>Try again</button></div></main>;
  if (index !== null && configuration && !source) return <main className="page"><div className="empty-state"><h1>Route not found</h1><p>The route may have been removed from the JSON file.</p><Link className="button button--primary" href="/routes">Back to routes</Link></div></main>;

  const issues = saveError instanceof DashboardApiError ? saveError.issues : [];

  return <main className="editor-page">
    <header className="editor-header">
      <div className="editor-header__identity"><Link href="/routes" className="icon-button" aria-label="Back to routes"><ArrowLeft size={18} /></Link><div><span className="eyebrow">{index === null ? "New route" : "Editing route"}</span><h1>{route.baseURL || "Untitled route"}</h1></div></div>
      <div className="page-actions"><Link className="button button--quiet" href="/routes">Cancel</Link><button className="button button--primary" type="button" disabled={saving} onClick={() => void submit()}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} {saving ? "Applying…" : "Save & apply"}</button></div>
    </header>
    <div className="editor-layout">
      <aside className="editor-nav"><p>Configuration</p>{sections.map(([id, label]) => <a href={`#${id}`} className={enabledSections.has(id) ? "enabled" : ""} key={id}><span />{label}</a>)}</aside>
      <div className="editor-content">
        {saveError ? <div className="error-banner"><AlertCircle size={18} /><div><strong>Could not apply this route</strong><p>{saveError.message}</p>{issues.length > 0 ? <ul>{issues.map((issue, issueIndex) => <li key={issueIndex}><code>{issue.path.join(".")}</code> {issue.message}</li>)}</ul> : null}</div></div> : null}
        <RouteEditor value={route} onChange={setRoute} />
      </div>
      <aside className="route-summary"><p className="eyebrow">Route summary</p><h2>{route.baseURL}</h2><dl><div><dt>Mode</dt><dd>{route.proxy.targets ? "Load balanced" : "Single target"}</dd></div><div><dt>Upstream</dt><dd>{route.proxy.target ?? `${route.proxy.targets?.length ?? 0} targets`}</dd></div><div><dt>Features</dt><dd>{enabledSections.size - 1} enabled</dd></div></dl><p className="route-summary__note">Saving validates the full routing table before replacing the local JSON file.</p></aside>
    </div>
  </main>;
}
