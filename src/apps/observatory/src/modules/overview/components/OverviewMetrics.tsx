import type { GatewayOverview } from "@/server/gateway/contracts";
import { formatNumber, type OverviewTotals } from "../overview.utils";
import { MetricCard } from "./MetricCard";

export function OverviewMetrics({
  overview,
  totals,
}: {
  overview: GatewayOverview | null;
  totals: OverviewTotals;
}) {
  return (
    <section className="metrics" aria-label="Gateway summary">
      <MetricCard label="Active routes" value={overview?.routeCount ?? "—"} />
      <MetricCard label="Requests" value={formatNumber(totals.requests)} />
      <MetricCard
        label="5xx responses"
        value={formatNumber(totals.serverErrors)}
      />
      <MetricCard
        label="Average latency"
        value={
          totals.averageLatencyMs === null
            ? "—"
            : `${totals.averageLatencyMs.toFixed(1)} ms`
        }
      />
    </section>
  );
}
