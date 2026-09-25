"use client";

import { useCallback, useEffect, useState } from "react";
import type { GatewayEvent, GatewayOverview } from "@/server/gateway/contracts";

const POLL_INTERVAL_MS = 10_000;

type OverviewResponse = GatewayOverview & { message?: string };
type EventsResponse = { events?: GatewayEvent[]; message?: string };

export function useObservatoryData() {
  const [overview, setOverview] = useState<GatewayOverview | null>(null);
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [overviewResponse, eventsResponse] = await Promise.all([
        fetch("/api/gateway/overview", { cache: "no-store" }),
        fetch("/api/gateway/events", { cache: "no-store" }),
      ]);
      const overviewPayload: OverviewResponse = await overviewResponse.json();
      const eventsPayload: EventsResponse = await eventsResponse.json();

      if (!overviewResponse.ok) {
        throw new Error(
          overviewPayload.message ?? "Could not load gateway status.",
        );
      }

      setOverview(overviewPayload);
      if (eventsResponse.ok) {
        setEvents(eventsPayload.events ?? []);
      }
      setError(null);
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load gateway status.",
      );
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { overview, events, error, updatedAt, refresh };
}
