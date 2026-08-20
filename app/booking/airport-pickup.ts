import type { SearchFlight, TripDurationResponse } from "~/api/flights/schema";
import { type BookingType, NIGHT_BOOKING_TYPE } from "~/booking/types";
import { SERVICE_TIMEZONE } from "~/time/timezone";

export const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{2,3}\d{1,5}$/i;

const arrivalTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
});

export function normalizeFlightNumber(value: string) {
  return value.trim().toUpperCase().replaceAll(/\s+/g, "");
}

export function isCompleteFlightNumber(value: string) {
  const normalized = normalizeFlightNumber(value);

  return FLIGHT_NUMBER_PATTERN.test(normalized) && /[A-Z]/i.test(normalized);
}

export function composeAirportPickupAddress(flight: SearchFlight) {
  const name = flight.destinationName?.trim();
  const city = flight.destinationCity?.trim();

  if (name && city) {
    return `${name}, ${city}`;
  }

  return (
    name || city || flight.destinationIATA?.trim() || flight.destination.trim() || "Lagos Airport"
  );
}

export function formatFlightArrivalSummary(flight: SearchFlight) {
  const origin = flight.originIATA?.trim() || flight.origin.trim();
  const destination = flight.destinationIATA?.trim() || flight.destination.trim();
  const arrival = arrivalTimeFormat.format(new Date(flight.arrivalTime)).replace(/\s+/g, " ");

  return `${origin} → ${destination} • ${arrival}`;
}

export function nightBookingHelperText(bookingType: BookingType, nights: number): string | null {
  if (bookingType !== NIGHT_BOOKING_TYPE || nights < 1) {
    return null;
  }

  return `All overnight bookings start at 11pm and end at 5am. Booking for ${nights} night${nights === 1 ? "" : "s"}.`;
}

export function formatTripDuration(duration: TripDurationResponse) {
  const minutes = Math.max(1, Math.round(duration.durationMinutes));
  const estimate = duration.isEstimate ? " (estimate)" : "";

  return `About ${minutes} min from the airport${estimate}`;
}
