import React from "react";

type BookingTypeKey = "DAY" | "NIGHT" | "FULL_DAY";

export type AvailabilityStatus = {
  available: BookingTypeKey[];
  unavailable: BookingTypeKey[];
};

const BOOKING_TYPE_LABEL: Record<"DAY" | "NIGHT" | "FULL_DAY", string> = {
  DAY: "Day (12hr)",
  NIGHT: "Night (6hr)",
  FULL_DAY: "Full day (24hr)",
};

export function AvailabilityHint({
  status,
  totalDays,
}: { readonly status?: AvailabilityStatus; readonly totalDays: number }) {
  if (!status || status.unavailable.length === 0) return null;

  const availableText = status.available.map((t) => BOOKING_TYPE_LABEL[t]).join(", ");

  return (
    <div className="text-xs text-gray-600 mt-1">
      {totalDays > 1 ? "Partially" : "Only"} available for {availableText}{" "}
      {status.available.length > 1 ? "bookings" : "booking"}
    </div>
  );
}
