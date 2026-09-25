import type { GatewayRoute } from "@/modules/configuration/types/configuration.types";

export function RouteSummary({
  route,
  enabledCount,
}: {
  route: GatewayRoute;
  enabledCount: number;
}) {
  return (
    <aside className="route-summary">
      <p className="eyebrow">Route summary</p>
      <h2>{route.baseURL}</h2>
      <dl>
        <div>
          <dt>Mode</dt>
          <dd>{route.proxy.targets ? "Load balanced" : "Single target"}</dd>
        </div>
        <div>
          <dt>Upstream</dt>
          <dd>{route.proxy.target ?? `${route.proxy.targets?.length ?? 0} targets`}</dd>
        </div>
        <div>
          <dt>Features</dt>
          <dd>{enabledCount} enabled</dd>
        </div>
      </dl>
      <p className="route-summary__note">
        Saving validates the full routing table before replacing the local JSON file.
      </p>
    </aside>
  );
}
