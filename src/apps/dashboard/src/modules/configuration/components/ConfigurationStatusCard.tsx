"use client";

import { RefreshCw } from "lucide-react";
import type { DashboardStatus } from "../services/configuration";
import { ConfigurationStatusDetails } from "./ConfigurationStatusDetails";

export function ConfigurationStatusCard({
  status,
  loading,
  onRefresh,
}: {
  status: DashboardStatus | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="settings-card">
      <div className="settings-card__heading">
        <div>
          <h2>Configuration driver</h2>
          <p>Current backend and the file it manages.</p>
        </div>
        <button className="button button--quiet button--small" type="button" onClick={onRefresh}>
          <RefreshCw className={loading ? "spin" : ""} size={15} /> Refresh
        </button>
      </div>
      {status ? (
        <ConfigurationStatusDetails status={status} />
      ) : (
        <div className="skeleton-card skeleton-card--short" />
      )}
    </section>
  );
}
