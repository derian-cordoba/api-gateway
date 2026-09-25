"use client";

import type { ConfigurationHistoryEntry } from "../services/configuration";
import { EmptyHistory } from "./EmptyHistory";
import { HistoryItem } from "./HistoryItem";

export function HistoryList({
  entries,
  restoring,
  canRestore,
  onRestore,
}: {
  entries: ConfigurationHistoryEntry[];
  restoring: string | null;
  canRestore: boolean;
  onRestore: (revision: string) => void;
}) {
  if (entries.length === 0) {
    return <EmptyHistory />;
  }

  return (
    <ul className="history-list">
      {entries.map((entry) => (
        <HistoryItem
          key={entry.revision}
          entry={entry}
          restoring={restoring === entry.revision}
          disabled={!canRestore || restoring !== null}
          onRestore={onRestore}
        />
      ))}
    </ul>
  );
}
