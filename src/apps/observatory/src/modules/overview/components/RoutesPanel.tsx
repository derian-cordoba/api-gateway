import type { RouteOverview } from "@/server/gateway/contracts";
import { RouteTableBody } from "./RouteTableBody";

export function RoutesPanel({
  routes,
  failingOnly,
  onFailingOnlyChange,
}: {
  routes: RouteOverview[];
  failingOnly: boolean;
  onFailingOnlyChange: (failingOnly: boolean) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Routes</h2>
          <p>Totals are process-local and reset when the gateway restarts.</p>
        </div>
        <label className="filter">
          <input
            type="checkbox"
            checked={failingOnly}
            onChange={(event) => onFailingOnlyChange(event.target.checked)}
          />
          Show failing only
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Requests</th>
              <th scope="col">4xx</th>
              <th scope="col">5xx</th>
              <th scope="col">Avg. latency</th>
              <th scope="col">Cache hit rate</th>
              <th scope="col">Rate limits</th>
              <th scope="col">Circuit</th>
            </tr>
          </thead>
          <RouteTableBody routes={routes} />
        </table>
      </div>
    </section>
  );
}
