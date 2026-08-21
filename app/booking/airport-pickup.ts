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

export function formatLagosClock(value: Date | string) {
  return arrivalTimeFormat.format(new Date(value)).replace(/\s+/g, " ");
}

export function formatFlightRoute(flight: SearchFlight) {
  const origin = flight.originIATA?.trim() || flight.origin.trim();
  const destination = flight.destinationIATA?.trim() || flight.destination.trim();

  return `${origin} → ${destination}`;
}

export function formatFlightArrivalSummary(flight: SearchFlight) {
  return `${formatFlightRoute(flight)} • ${formatLagosClock(flight.arrivalTime)}`;
}

const PICKUP_AFTER_ARRIVAL_MS = 40 * 60 * 1000;

export function bufferedDriveMinutes(durationMinutes: number) {
  return Math.ceil(durationMinutes * 1.2);
}

export function formatBufferedDrive(minutes: number) {
  if (minutes < 60) {
    return `${minutes} mins`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }

  return `${hours} hour${hours > 1 ? "s" : ""} ${remainingMinutes} mins`;
}

export function formatDistanceText(distanceMeters: number) {
  if (distanceMeters <= 0) {
    return "Distance unavailable";
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function buildTripDetails(arrivalTime: string, duration: TripDurationResponse) {
  const arrival = new Date(arrivalTime);
  const pickup = new Date(arrival.getTime() + PICKUP_AFTER_ARRIVAL_MS);
  const driveMinutes = bufferedDriveMinutes(duration.durationMinutes);
  const dropOff = new Date(pickup.getTime() + driveMinutes * 60 * 1000);

  return {
    arrivalTime: formatLagosClock(arrival),
    pickupTime: formatLagosClock(pickup),
    driveText: formatBufferedDrive(driveMinutes),
    distanceText: formatDistanceText(duration.distanceMeters),
    dropOffTime: formatLagosClock(dropOff),
    isEstimate: duration.isEstimate,
  };
}

export function nightBookingHelperText(bookingType: BookingType, nights: number): string | null {
  if (bookingType !== NIGHT_BOOKING_TYPE || nights < 1) {
    return null;
  }

  return `All overnight bookings start at 11pm and end at 5am. Booking for ${nights} night${nights === 1 ? "" : "s"}.`;
}
