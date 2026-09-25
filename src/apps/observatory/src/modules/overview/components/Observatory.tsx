"use client";

import { useMemo, useState } from "react";
import { useObservatoryData } from "../hooks/useObservatoryData";
import { getVisibleRoutes, getOverviewTotals } from "../overview.utils";
import { ObservatoryHeader } from "./ObservatoryHeader";
import { OverviewMetrics } from "./OverviewMetrics";
import { RecentActivityPanel } from "./RecentActivityPanel";
import { RoutesPanel } from "./RoutesPanel";

export function Observatory() {
  const { overview, events, error, updatedAt, refresh } = useObservatoryData();
  const [failingOnly, setFailingOnly] = useState(false);

  const routes = useMemo(
    () => getVisibleRoutes(overview?.routes ?? [], failingOnly),
    [failingOnly, overview],
  );

  const totals = useMemo(
    () => getOverviewTotals(overview?.routes ?? []),
    [overview],
  );

  return (
    <main className="page">
      <ObservatoryHeader
        ready={overview?.ready ?? null}
        hasError={error !== null}
        onRefresh={refresh}
      />
      {error && <GatewayError message={error} />}
      <OverviewMetrics overview={overview} totals={totals} />
      <RoutesPanel
        routes={routes}
        failingOnly={failingOnly}
        onFailingOnlyChange={setFailingOnly}
      />
      <RecentActivityPanel events={events} updatedAt={updatedAt} />
    </main>
  );
}

function GatewayError({ message }: { message: string }) {
  return (
    <section className="alert" role="alert">
      <h2>Observatory cannot reach the gateway</h2>
      <p>{message}</p>
    </section>
  );
}
