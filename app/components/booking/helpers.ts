import {
  BookingType,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
  AIRPORT_PICKUP_BOOKING_TYPE,
} from "../bookingTypes";

export function getOrdinal(n: number): string {
  const mod100 = n % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function getFuelTankNote(
  totalDays: number,
  requiresFullTank = false,
  bookingType?: BookingType,
  pricingIncludesFuel?: boolean,
): string | null {
  if (totalDays <= 0) {
    return null;
  }

  // If pricing includes fuel, don't show fuel note
  if (pricingIncludesFuel) {
    return null;
  }

  let note: string | null = null;

  // For 24-hour bookings, always comes with a full tank
  if (bookingType === FULL_DAY_BOOKING_TYPE) {
    note = "24-hour booking comes with a full tank";
  } else if (bookingType === NIGHT_BOOKING_TYPE) {
    note = "Night booking comes with 1/3rd of a tank";
  } else if (bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
    note = "Airport pickup comes with a full tank";
  } else if (requiresFullTank && totalDays <= 2) {
    note = "Booking comes with a full tank";
  } else if (totalDays === 1) {
    note = "Booking comes with 1/3rd of a tank";
  } else if (totalDays === 2) {
    note = "Booking comes with 2/3rd of a tank";
  } else if (totalDays >= 3) {
    note = "Booking comes with a full tank";
  }

  return note ? `${note}, after which, it's your responsibility to fill the tank.` : null;
}
