"use client";

import { useConfigurationHistory } from "../hooks/useConfigurationHistory";
import { HistoryList } from "./HistoryList";

export function ConfigurationHistoryCard() {
  const {
    history,
    historyLoading,
    error,
    restoring,
    configurationError,
    canRestore,
    refreshHistory,
    reloadConfiguration,
    restore,
  } = useConfigurationHistory();

  return (
    <section className="settings-card">
      <div className="settings-card__heading">
        <div>
          <h2>Configuration history</h2>
          <p>Restore a previous revision after reviewing its timestamp.</p>
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {configurationError && (
        <>
          <p className="field-error" role="alert">
            {configurationError.message}
          </p>
          <button
            className="button button--quiet button--small"
            type="button"
            onClick={() => void reloadConfiguration()}
          >
            Retry configuration
          </button>
        </>
      )}
      {history === null && historyLoading && <p>Loading revisions…</p>}
      {history === null && !historyLoading && error && (
        <button
          className="button button--quiet button--small"
          type="button"
          onClick={() => void refreshHistory()}
        >
          Try again
        </button>
      )}
      {history !== null && (
        <HistoryList
          entries={history}
          restoring={restoring}
          canRestore={canRestore}
          onRestore={(revision) => void restore(revision)}
        />
      )}
    </section>
  );
}
