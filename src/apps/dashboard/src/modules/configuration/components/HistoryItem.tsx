"use client";

import type { ConfigurationHistoryEntry } from "../services/configuration";

export function HistoryItem({
  entry,
  restoring,
  disabled,
  onRestore,
}: {
  entry: ConfigurationHistoryEntry;
  restoring: boolean;
  disabled: boolean;
  onRestore: (revision: string) => void;
}) {
  return (
    <li className="history-list__item">
      <code>{entry.revision}</code>
      <time dateTime={entry.updatedAt}>{new Date(entry.updatedAt).toLocaleString()}</time>
      <button
        className="button button--quiet button--small"
        type="button"
        disabled={disabled}
        onClick={() => onRestore(entry.revision)}
      >
        {restoring ? "Restoring…" : "Restore"}
      </button>
    </li>
  );
}
