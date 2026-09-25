import type { GatewayEvent } from "@/server/gateway/contracts";
import { ActivityItem } from "./ActivityItem";
import { EmptyActivity } from "./EmptyActivity";

export function ActivityList({ events }: { events: GatewayEvent[] }) {
  return (
    <ol>
      {events.length > 0 ? (
        events.map((event) => <ActivityItem key={event.id} event={event} />)
      ) : (
        <EmptyActivity />
      )}
    </ol>
  );
}
