"use client";

import Link from "next/link";
import { Download, Plus, RefreshCw } from "lucide-react";

export function RoutesHeader({
  onExport,
  onRefresh,
}: {
  onExport: () => void;
  onRefresh: () => void;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">Routing table</span>
        <h1>Routes</h1>
        <p>Configure upstreams and route-level gateway behavior.</p>
      </div>
      <div className="page-actions">
        <button className="button button--quiet" type="button" onClick={onExport}>
          <Download size={17} /> Export
        </button>
        <button className="button button--quiet" type="button" onClick={onRefresh}>
          <RefreshCw size={17} /> Refresh
        </button>
        <Link className="button button--primary" href="/routes/edit">
          <Plus size={17} /> New route
        </Link>
      </div>
    </header>
  );
}
