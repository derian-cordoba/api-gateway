"use client";

import { useState } from "react";
import { Check, KeyRound, RefreshCw, Save } from "lucide-react";
import { useDashboardStatus } from "../hooks/useDashboardStatus";
import { configurationService } from "../services/configuration";
import { FormField, TextInput } from "@/modules/shared/components/FormControls";

export function SettingsPage() {
  const [token, setToken] = useState(configurationService.getDashboardToken);
  const [saved, setSaved] = useState(false);
  const { status, loading, refresh } = useDashboardStatus();

  const saveToken = () => {
    configurationService.setDashboardToken(token);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    void refresh();
  };

  return (
    <main className="page page--narrow">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>Settings</h1>
          <p>Connection and local configuration storage.</p>
        </div>
      </header>
      <section className="settings-card">
        <div className="settings-card__heading">
          <span className="settings-card__icon">
            <KeyRound size={20} />
          </span>
          <div>
            <h2>Dashboard access token</h2>
            <p>Stored only in this browser and sent with configuration requests.</p>
          </div>
        </div>
        <FormField label="Token">
          <TextInput
            type="password"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Required when DASHBOARD_TOKEN is configured"
          />
        </FormField>
        <button className="button button--primary" type="button" onClick={saveToken}>
          {saved ? <Check size={17} /> : <Save size={17} />}
          {saved ? "Saved" : "Save token"}
        </button>
      </section>
      <section className="settings-card">
        <div className="settings-card__heading">
          <div>
            <h2>Configuration driver</h2>
            <p>Current backend and the file it manages.</p>
          </div>
          <button
            className="button button--quiet button--small"
            type="button"
            onClick={() => void refresh()}
          >
            <RefreshCw className={loading ? "spin" : ""} size={15} /> Refresh
          </button>
        </div>
        {status ? (
          <dl className="settings-list">
            <div>
              <dt>Status</dt>
              <dd>
                <span
                  className={
                    status.status === "ready" ? "status-dot" : "status-dot status-dot--error"
                  }
                />{" "}
                {status.status}
              </dd>
            </div>
            <div>
              <dt>Driver</dt>
              <dd>{status.storage ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Route count</dt>
              <dd>{status.routeCount ?? "—"}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>
                <code>{status.revision ?? "—"}</code>
              </dd>
            </div>
            <div>
              <dt>File</dt>
              <dd className="path-value">{status.filePath ?? status.message ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <div className="skeleton-card skeleton-card--short" />
        )}
      </section>
    </main>
  );
}
