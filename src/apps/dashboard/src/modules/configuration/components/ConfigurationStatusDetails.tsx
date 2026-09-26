import type { DashboardStatus } from "../services/configuration";

export function ConfigurationStatusDetails({ status }: { status: DashboardStatus }) {
  return (
    <dl className="settings-list">
      <div>
        <dt>Status</dt>
        <dd>
          <span
            className={status.status === "ready" ? "status-dot" : "status-dot status-dot--error"}
          />{" "}
          {status.status}
        </dd>
      </div>
      <div>
        <dt>Driver</dt>
        <dd>{status.storage ?? "Unavailable"}</dd>
      </div>
      {status.environment && (
        <div>
          <dt>Environment</dt>
          <dd>{status.environment}</dd>
        </div>
      )}
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
        <dt>Configuration</dt>
        <dd className="path-value">
          {status.filePath ?? status.configurationKey ?? status.message ?? "—"}
        </dd>
      </div>
    </dl>
  );
}
