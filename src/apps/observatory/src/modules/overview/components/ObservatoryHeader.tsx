"use client";

export function ObservatoryHeader({
  ready,
  hasError,
  onRefresh,
}: {
  ready: boolean | null;
  hasError: boolean;
  onRefresh: () => void;
}) {
  const status = hasError
    ? { className: "status--unknown", label: "Gateway unavailable" }
    : ready === null
      ? { className: "status--unknown", label: "Connecting to gateway…" }
      : ready
        ? { className: "status--healthy", label: "Gateway ready" }
        : { className: "status--unknown", label: "Gateway not ready" };

  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">Read-only operations</p>
        <h1>Gateway Observatory</h1>
        <p className="subtitle">
          Live traffic, route health, and recent gateway activity.
        </p>
      </div>
      <div className="header-actions">
        <span className={`status ${status.className}`} role="status">
          {status.label}
        </span>
        <button type="button" onClick={() => void onRefresh()}>
          Refresh
        </button>
      </div>
    </header>
  );
}
