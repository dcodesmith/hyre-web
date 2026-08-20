import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { SearchFlight, TripDurationResponse } from "~/api/flights/schema";
import { normalizeFlightNumber } from "~/booking/airport-pickup";

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
 * Fetcher completion is an external system, so the fetchers live here
 * instead of in the booking card or search form.
 */
export function useAirportPickup({
  onFlightFound,
}: {
  readonly onFlightFound?: (flight: SearchFlight) => void;
} = {}) {
  const flightFetcher = useFetcher<SearchFlightLoaderData>();
  const durationFetcher = useFetcher<TripDurationLoaderData>();
  const onFlightFoundRef = useRef(onFlightFound);
  const lastAppliedFlightIdRef = useRef<string | null>(null);

  onFlightFoundRef.current = onFlightFound;

  useEffect(() => {
    if (flightFetcher.state !== "idle") {
      return;
    }

    const flight = flightFetcher.data?.flight;

    if (!flight || lastAppliedFlightIdRef.current === flight.flightId) {
      return;
    }

    lastAppliedFlightIdRef.current = flight.flightId;
    onFlightFoundRef.current?.(flight);
  }, [flightFetcher.data, flightFetcher.state]);

  const flightResult = flightFetcher.state === "idle" ? flightFetcher.data : undefined;
  const durationResult = durationFetcher.state === "idle" ? durationFetcher.data : undefined;

  return {
    searchFlight: (flightNumber: string, date: string) => {
      lastAppliedFlightIdRef.current = null;
      const params = new URLSearchParams({
        flightNumber: normalizeFlightNumber(flightNumber),
        date,
      });
      void flightFetcher.load(`/api/search-flight?${params}`);
    },
    resetFlight: () => {
      lastAppliedFlightIdRef.current = null;
      flightFetcher.reset();
    },
    isValidatingFlight: flightFetcher.state !== "idle",
    flight: flightResult?.flight ?? null,
    flightError: flightResult?.error ?? null,
    flightWarning: flightResult?.warning ?? null,
    calculateDuration: (destination: string) => {
      const params = new URLSearchParams({ destination });
      void durationFetcher.load(`/api/calculate-trip-duration?${params}`);
    },
    resetDuration: () => {
      durationFetcher.reset();
    },
    tripDuration: durationResult?.duration ?? null,
  };
}
