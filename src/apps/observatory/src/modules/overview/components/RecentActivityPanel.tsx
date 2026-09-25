import type { GatewayEvent } from "@/server/gateway/contracts";
import { ActivityList } from "./ActivityList";

export function RecentActivityPanel({
  events,
  updatedAt,
}: {
  events: GatewayEvent[];
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
      </div>
      <ActivityList events={events} />
    </section>
  );
}
