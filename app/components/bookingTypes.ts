// Shared booking type constants and mappings

export const DAY_BOOKING_TYPE = "DAY" as const;
export const NIGHT_BOOKING_TYPE = "NIGHT" as const;
export const FULL_DAY_BOOKING_TYPE = "FULL_DAY" as const;
export const AIRPORT_PICKUP_BOOKING_TYPE = "AIRPORT_PICKUP" as const;

export const BOOKING_TYPE_OPTIONS = [
  DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  AIRPORT_PICKUP_BOOKING_TYPE,
] as const;

export type BookingType = (typeof BOOKING_TYPE_OPTIONS)[number];

// Map tab values back to booking types
export const TAB_VALUE_TO_BOOKING_TYPE: Record<string, BookingType> = {
  day: DAY_BOOKING_TYPE,
  night: NIGHT_BOOKING_TYPE,
  "full-day": FULL_DAY_BOOKING_TYPE,
  "airport-pickup": AIRPORT_PICKUP_BOOKING_TYPE,
};

export const BOOKING_TYPE_OPTIONS_MAP = {
  [DAY_BOOKING_TYPE]: {
    label: "Same Day",
    duration: "12 hours",
    value: "day",
  },
  [NIGHT_BOOKING_TYPE]: {
    label: "Night",
    duration: "6 hours",
    value: "night",
  },
  [FULL_DAY_BOOKING_TYPE]: {
    label: "Full Day",
    duration: "24 hours",
    value: "full-day",
  },
  [AIRPORT_PICKUP_BOOKING_TYPE]: {
    label: "Airport",
    duration: "Pickup",
    value: "airport-pickup",
  },
} as const;

export const BOOKING_TYPE_LABELS = {
  [DAY_BOOKING_TYPE]: { singular: "day", plural: "days", perUnit: "12-hour day" },
  [NIGHT_BOOKING_TYPE]: { singular: "night", plural: "nights", perUnit: "6-hour night" },
  [FULL_DAY_BOOKING_TYPE]: { singular: "full day", plural: "full days", perUnit: "24-hour day" },
  [AIRPORT_PICKUP_BOOKING_TYPE]: {
    singular: "airport pickup",
    plural: "airport pickups",
    perUnit: "airport pickup",
  },
} as const;
