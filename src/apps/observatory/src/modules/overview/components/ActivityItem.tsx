import type { GatewayEvent } from "@/server/gateway/contracts";

export function ActivityItem({ event }: { event: GatewayEvent }) {
  return (
    <li>
      <time dateTime={event.timestamp}>
        {new Date(event.timestamp).toLocaleTimeString()}
      </time>
      <span>{event.route ?? "Gateway"}</span>
      <p>{event.message}</p>
    </li>
  );
}
