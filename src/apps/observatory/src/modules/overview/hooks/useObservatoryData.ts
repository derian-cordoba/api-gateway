"use client";

import { useCallback, useEffect, useState } from "react";
import { toError } from "@shared/errors/toError";
import type { GatewayEvent, GatewayOverview } from "@/server/gateway/contracts";
import { DEFAULT_EVENT_LIMIT } from "../event-limit";
import { observatoryApi } from "../services/observatory-api";

const POLL_INTERVAL_MS = 10_000;

export function useObservatoryData() {
  const [overview, setOverview] = useState<GatewayOverview | null>(null);
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [eventLimit, setEventLimit] = useState(DEFAULT_EVENT_LIMIT);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [overviewResult, eventsResult] = await Promise.allSettled([
        observatoryApi.getOverview(),
        observatoryApi.getEvents(eventLimit),
      ]);

      if (overviewResult.status === "rejected") {
        throw overviewResult.reason;
      }

      setOverview(overviewResult.value);
      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value.events);
      }
      setError(null);
      setUpdatedAt(new Date());
    } catch (cause) {
      setError(toError(cause).message || "Could not load gateway status.");
    }
  }, [eventLimit]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return {
    overview,
    events,
    eventLimit,
    setEventLimit,
    error,
    updatedAt,
    refresh,
  };
}
