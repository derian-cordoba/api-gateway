import type { GatewayEvent } from "@/server/gateway/contracts";
import { ActivityList } from "./ActivityList";
import { EventLimitFilter } from "./EventLimitFilter";

export function RecentActivityPanel({
  events,
  eventLimit,
  onEventLimitChange,
  updatedAt,
}: {
  events: GatewayEvent[];
  eventLimit: number;
  onEventLimitChange: (limit: number) => void;
  updatedAt: Date | null;
}) {
  return (
    <section className="panel activity">
      <div className="panel-header">
        <div>
          <h2>Recent activity</h2>
          <p>
            {updatedAt
              ? `Last refreshed ${updatedAt.toLocaleTimeString()}`
              : "Waiting for the first gateway response."}
          </p>
        </div>
        <EventLimitFilter value={eventLimit} onChange={onEventLimitChange} />
      </div>
      <ActivityList events={events} />
    </section>
  );
}
