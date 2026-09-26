"use client";

import { RouteSourcesCard } from "@/modules/route-sources/components/RouteSourcesCard";
import { useConfiguration } from "../hooks/useConfiguration";
import { useState } from "react";
import { ConfigurationHistoryCard } from "../components/ConfigurationHistoryCard";
import { ConfigurationStatusCard } from "../components/ConfigurationStatusCard";
import { DashboardTokenCard } from "../components/DashboardTokenCard";
import { useDashboardStatus } from "../hooks/useDashboardStatus";
import { configurationService } from "../services/configuration";

export function SettingsPage() {
  const { sourceId } = useConfiguration();
  const { status, loading, refresh } = useDashboardStatus();
  const [tokenVersion, setTokenVersion] = useState(0);
  return (
    <main className="page page--narrow">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>Settings</h1>
          <p>Connection, route sources, and configuration history.</p>
        </div>
      </header>
      <DashboardTokenCard
        onSaved={() => {
          void refresh();
          void configurationService.reload();
          setTokenVersion((version) => version + 1);
        }}
      />
      <RouteSourcesCard key={`sources-${tokenVersion}`} />
      <ConfigurationStatusCard status={status} loading={loading} onRefresh={() => void refresh()} />
      <ConfigurationHistoryCard key={`${tokenVersion}:${sourceId}`} />
    </main>
  );
}
