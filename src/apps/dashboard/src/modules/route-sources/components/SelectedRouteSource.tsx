"use client";

import Link from "next/link";
import { useConfiguration } from "@/modules/configuration/hooks/useConfiguration";

export function SelectedRouteSource() {
  const { sourceId, configuration } = useConfiguration();
  return (
    <p className="route-source-label">
      Editing source: <strong>{configuration?.source?.name ?? sourceId}</strong>
      {configuration?.source?.environment && ` · ${configuration.source.environment}`} ·{" "}
      <Link href="/settings">Manage sources</Link>
    </p>
  );
}
