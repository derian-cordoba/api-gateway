"use client";

import { useState } from "react";
import { ConfigurationHistoryCard } from "../components/ConfigurationHistoryCard";
import { ConfigurationStatusCard } from "../components/ConfigurationStatusCard";
import { DashboardTokenCard } from "../components/DashboardTokenCard";
import { useDashboardStatus } from "../hooks/useDashboardStatus";
import { configurationService } from "../services/configuration";

export function SettingsPage() {
  const { status, loading, refresh } = useDashboardStatus();
  const [tokenVersion, setTokenVersion] = useState(0);
  return (
    <main className="page page--narrow">
      <header className="page-header">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>Settings</h1>
          <p>Connection and local configuration storage.</p>
        </div>
      </header>
      <DashboardTokenCard
        onSaved={() => {
          void refresh();
          void configurationService.reload();
          setTokenVersion((version) => version + 1);
        }}
      />
      <ConfigurationStatusCard status={status} loading={loading} onRefresh={() => void refresh()} />
      <ConfigurationHistoryCard key={tokenVersion} />
    </main>
  );
}
