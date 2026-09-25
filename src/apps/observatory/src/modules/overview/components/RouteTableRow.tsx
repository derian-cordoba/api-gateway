import type { RouteOverview } from "@/server/gateway/contracts";
import { formatNumber } from "../overview.utils";

export function RouteTableRow({ route }: { route: RouteOverview }) {
  const cacheRate = route.requestsTotal
    ? (route.cacheHitsTotal / route.requestsTotal) * 100
    : 0;

  return (
    <tr>
      <th scope="row">
        <code>{route.baseURL}</code>
      </th>
      <td>{formatNumber(route.requestsTotal)}</td>
      <td>{formatNumber(route.clientErrorsTotal)}</td>
      <td>{formatNumber(route.serverErrorsTotal)}</td>
      <td>
        {route.averageLatencyMs === null
          ? "—"
          : `${route.averageLatencyMs.toFixed(1)} ms`}
      </td>
      <td>{route.requestsTotal ? `${cacheRate.toFixed(1)}%` : "—"}</td>
      <td>{formatNumber(route.rateLimitRejectionsTotal)}</td>
      <td>
        <span
          className={
            route.circuitState === "OPEN" ? "circuit circuit--open" : "circuit"
          }
        >
          {route.circuitState ?? "Not configured"}
        </span>
      </td>
    </tr>
  );
}
