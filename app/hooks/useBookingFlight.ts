import { useCallback, useEffect, useRef, useState } from "react";
import { AIRPORT_PICKUP_BOOKING_TYPE, type BookingType } from "~/components/bookingTypes";
import type { ValidatedFlight } from "~/services/flight-validation.server";

interface TripDuration {
  readonly durationInMinutes: number;
  readonly durationText: string;
  readonly distanceText: string;
  readonly status: "success" | "fallback";
}

interface UseBookingFlightParams {
  readonly bookingType: BookingType;
  readonly searchParams: URLSearchParams;
  /** Called whenever validated flight state is committed (including clears). */
  readonly onValidatedFlightCommit?: () => void;
}

interface UseBookingFlightResult {
  readonly validatedFlight: ValidatedFlight | null;
  readonly setValidatedFlight: (flight: ValidatedFlight | null) => void;
  readonly tripDuration: TripDuration | null;
  readonly processedFlightRef: React.MutableRefObject<string | null>;
  readonly handleDropOffAddressSelected: (address: string) => Promise<void>;
  readonly clearFlightState: () => void;
}

function normalizeFlightNumber(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Hook for managing flight state in the booking flow.
 * Handles automatic flight validation from URL params and trip duration calculation.
 * Used by BookingCard for airport pickup bookings.
 */
export function useBookingFlight({
  bookingType,
  searchParams,
  onValidatedFlightCommit,
}: UseBookingFlightParams): UseBookingFlightResult {
  const [validatedFlight, setValidatedFlight] = useState<ValidatedFlight | null>(null);
  const [tripDuration, setTripDuration] = useState<TripDuration | null>(null);
  const processedFlightRef = useRef<string | null>(null);
  const tripDurationRequestRef = useRef(0);

  const commitValidatedFlight = useCallback(
    (flight: ValidatedFlight | null) => {
      setValidatedFlight(flight);
      onValidatedFlightCommit?.();
    },
    [onValidatedFlightCommit],
  );

  const clearFlightState = useCallback(() => {
    commitValidatedFlight(null);
    setTripDuration(null);
    processedFlightRef.current = null;
  }, [commitValidatedFlight]);

  // Auto-validate flight from URL on component mount
  useEffect(() => {
    const flightNumber = searchParams.get("flightNumber");

    // Clear validatedFlight when bookingType changes away from airport pickup
    if (bookingType !== AIRPORT_PICKUP_BOOKING_TYPE) {
      if (validatedFlight !== null || tripDuration !== null) {
        clearFlightState();
      }
      return;
    }

    // Clear validated flight only when URL explicitly carries a different flight number.
    const normalizedUrlFlight = normalizeFlightNumber(flightNumber);
    const normalizedValidatedFlight = normalizeFlightNumber(validatedFlight?.flightNumber);
    if (
      validatedFlight !== null &&
      normalizedUrlFlight.length > 0 &&
      normalizedValidatedFlight !== normalizedUrlFlight
    ) {
      clearFlightState();
      return;
    }

    // Only validate when bookingType is AIRPORT_PICKUP and validatedFlight is null
    if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE && validatedFlight === null) {
      const from = searchParams.get("from");

      if (flightNumber && from) {
        const controller = new AbortController();

        const validateFlightFromUrl = async () => {
          try {
            const response = await fetch(
              `/api/search-flight?flightNumber=${encodeURIComponent(flightNumber)}&date=${from}`,
              { signal: controller.signal },
            );

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.flight && !controller.signal.aborted) {
                commitValidatedFlight(data.flight);
              }
            }
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              return;
            }
            console.error("Failed to validate flight from URL:", error);
          }
        };

        validateFlightFromUrl();

        return () => controller.abort();
      }
    }
  }, [
    searchParams,
    bookingType,
    validatedFlight,
    tripDuration,
    clearFlightState,
    commitValidatedFlight,
  ]);

  // Calculate trip duration for AIRPORT_PICKUP bookings when drop-off address is selected
  const handleDropOffAddressSelected = useCallback(
    async (address: string) => {
      if (bookingType !== AIRPORT_PICKUP_BOOKING_TYPE || !validatedFlight) {
        return;
      }

      if (!address || address.trim().length === 0) {
        setTripDuration(null);
        return;
      }

      const requestId = ++tripDurationRequestRef.current;

      try {
        const params = new URLSearchParams({
          destination: address,
        });

        const arrivalTimeForDuration =
          validatedFlight.estimatedArrival ??
          validatedFlight.actualArrival ??
          validatedFlight.scheduledArrival;

        if (arrivalTimeForDuration) {
          params.set("arrivalTime", arrivalTimeForDuration);
        }

        const response = await fetch(`/api/calculate-trip-duration?${params.toString()}`);

        if (response.ok) {
          const data = await response.json();

          if (tripDurationRequestRef.current !== requestId) {
            return;
          }

          if (data.success) {
            setTripDuration({
              durationInMinutes: data.durationInMinutes,
              durationText: data.durationText,
              distanceText: data.distanceText,
              status: data.status,
            });
          } else {
            setTripDuration(null);
          }
        } else {
          setTripDuration(null);
        }
      } catch (error) {
        console.error("Failed to calculate trip duration:", error);
        setTripDuration(null);
      }
    },
    [bookingType, validatedFlight],
  );

  return {
    validatedFlight,
    setValidatedFlight: commitValidatedFlight,
    tripDuration,
    processedFlightRef,
    handleDropOffAddressSelected,
    clearFlightState,
  };
}
