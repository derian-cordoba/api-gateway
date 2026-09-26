"use client";

import { useEffect, useRef } from "react";
import type { RouteSourceSummary, SourceHealth } from "../services/route-sources";

export function RouteSourceActivationDialog({
  source,
  health,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  source: RouteSourceSummary;
  health: SourceHealth;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="settings-card route-source-dialog"
      aria-labelledby="activate-source-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onCancel();
        }
      }}
    >
      <h2 id="activate-source-title">Activate {source.name}?</h2>
      <p>
        This changes the routes served by the gateway. Other gateway instances apply the selection
        on their next successful synchronization.
      </p>
      <p>
        {source.driver} {source.environment} · {health.routeCount} routes
      </p>
      <p>
        Revision: <code>{health.revision}</code>
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="route-source-actions">
        <button type="button" className="button button--quiet" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Activating…" : "Activate source"}
        </button>
      </div>
    </dialog>
  );
}
