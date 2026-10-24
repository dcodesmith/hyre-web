import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { useFetcher } from "react-router";

import type { SearchFlight, TripDurationResponse } from "~/api/flights/schema";
import { isCompleteFlightNumber, normalizeFlightNumber } from "~/booking/airport-pickup";

interface SearchFlightLoaderData {
  readonly flight: SearchFlight | null;
  readonly warning: string | null;
  readonly error: string | null;
}

interface TripDurationLoaderData {
  readonly duration: TripDurationResponse | null;
  readonly error: string | null;
}

/**
 * Same-origin airport-pickup flight lookup and trip-duration estimate.
 *
 * Fetcher completion and URL-driven lookup are external synchronization,
 * so they live here instead of in the booking card or search form.
 */
export function useAirportPickup({
  onFlightFound,
  flightNumber,
  date,
  destination,
}: {
  readonly onFlightFound?: (flight: SearchFlight) => void;
  readonly flightNumber?: string | null;
  readonly date?: string | null;
  readonly destination?: string | null;
} = {}) {
  const flightFetcher = useFetcher<SearchFlightLoaderData>();
  const durationFetcher = useFetcher<TripDurationLoaderData>();
  const lastAppliedFlightIdRef = useRef<string | null>(null);
  const lastRequestedKeyRef = useRef<string | null>(null);
  const lastDestinationRef = useRef<string | null>(null);

  const notifyFlightFound = useEffectEvent((flight: SearchFlight) => {
    onFlightFound?.(flight);
  });

  const requestFlightLookup = useCallback(
    (nextFlightNumber: string, nextDate: string) => {
      const normalized = normalizeFlightNumber(nextFlightNumber);
      lastRequestedKeyRef.current = `${normalized}|${nextDate}`;
      lastAppliedFlightIdRef.current = null;
      const params = new URLSearchParams({
        flightNumber: normalized,
        date: nextDate,
      });
      void flightFetcher.load(`/api/search-flight?${params}`);
    },
    [flightFetcher],
  );

  useEffect(() => {
    if (!flightNumber || !date || !isCompleteFlightNumber(flightNumber)) {
      return;
    }

    const key = `${normalizeFlightNumber(flightNumber)}|${date}`;

    if (lastRequestedKeyRef.current === key) {
      return;
    }

    requestFlightLookup(flightNumber, date);
  }, [date, flightNumber, requestFlightLookup]);

  useEffect(() => {
    if (flightFetcher.state !== "idle") {
      return;
    }

    const flight = flightFetcher.data?.flight;

    if (flightFetcher.data === undefined) {
      return;
    }

    if (!flight) {
      lastRequestedKeyRef.current = null;
      return;
    }

    if (lastAppliedFlightIdRef.current === flight.flightId) {
      return;
    }

    lastAppliedFlightIdRef.current = flight.flightId;
    notifyFlightFound(flight);
  }, [flightFetcher.data, flightFetcher.state]);

  const requestDuration = useEffectEvent((nextDestination: string) => {
    const params = new URLSearchParams({ destination: nextDestination });
    void durationFetcher.load(`/api/calculate-trip-duration?${params}`);
  });
  const clearDuration = useEffectEvent(() => {
    durationFetcher.reset();
  });

  useEffect(() => {
    const next = destination?.trim();

    if (!next) {
      lastDestinationRef.current = null;
      if (durationFetcher.state === "idle" && durationFetcher.data) {
        clearDuration();
      }
      return;
    }

    if (lastDestinationRef.current === next) {
      return;
    }

    lastDestinationRef.current = next;
    requestDuration(next);
  }, [destination, durationFetcher.data, durationFetcher.state]);

  const flightResult = flightFetcher.state === "idle" ? flightFetcher.data : undefined;
  const durationResult = durationFetcher.state === "idle" ? durationFetcher.data : undefined;

  return {
    searchFlight: (nextFlightNumber: string, nextDate: string) => {
      requestFlightLookup(nextFlightNumber, nextDate);
    },
    resetFlight: () => {
      lastAppliedFlightIdRef.current = null;
      lastRequestedKeyRef.current = null;
      flightFetcher.reset();
    },
    isValidatingFlight: flightFetcher.state !== "idle",
    flight: flightResult?.flight ?? null,
    flightError: flightResult?.error ?? null,
    flightWarning: flightResult?.warning ?? null,
    calculateDuration: (nextDestination: string) => {
      const next = nextDestination.trim();

      if (!next) {
        return;
      }

      lastDestinationRef.current = next;
      const params = new URLSearchParams({ destination: next });
      void durationFetcher.load(`/api/calculate-trip-duration?${params}`);
    },
    resetDuration: () => {
      lastDestinationRef.current = null;
      durationFetcher.reset();
    },
    tripDuration: durationResult?.duration ?? null,
    tripDurationError: durationResult?.error ?? null,
  };
}
