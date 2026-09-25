"use client";

import { AlertCircle } from "lucide-react";

export function RoutesErrorBanner({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <AlertCircle size={18} />
      <div>
        <strong>Could not load or update configuration</strong>
        <p>{error.message}</p>
      </div>
      <button className="button button--quiet button--small" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
