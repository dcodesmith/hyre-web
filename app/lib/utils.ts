import { BookingStatus, Prisma } from "@prisma/client";
import { useFormAction, useNavigation } from "@remix-run/react";
import { type ClassValue, clsx } from "clsx";
import {
  addDays,
  differenceInHours,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import { twMerge } from "tailwind-merge";
import { match } from "ts-pattern";
import { BookingLegWithRelations, BookingWithRelations, Extension } from "~/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useIsPending({
  formAction,
  formMethod = "POST",
  state = "non-idle",
}: {
  formAction?: string;
  formMethod?: "POST" | "GET" | "PUT" | "PATCH" | "DELETE";
  state?: "submitting" | "loading" | "non-idle";
} = {}) {
  const contextualFormAction = useFormAction();
  const navigation = useNavigation();
  const isPendingState =
    state === "non-idle" ? navigation.state !== "idle" : navigation.state === state;
  return (
    isPendingState &&
    navigation.formAction === (formAction ?? contextualFormAction) &&
    navigation.formMethod === formMethod
  );
}

export function formatDate(date: string | Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    // year: "numeric",
    // month: "short",
    // day: "2-digit",
    // hour: "numeric",
    // minute: "numeric",
    // hour12: true,
  });

  function replaceWithOrdinalSuffix(day: string) {
    const num = Number.parseInt(day);
    const suffix = ["th", "st", "nd", "rd"][
      num % 10 > 3 || (num % 100) - (num % 10) === 10 ? 0 : num % 10
    ];
    return `${num}${suffix}`;
  }

  return formatter
    .format(new Date(date))
    .replace(/,/g, " @")
    .replace(/(\d+)(?=\s)/, replaceWithOrdinalSuffix);

  // let datePart = "";
  // let timePart = "";
  // const parts = formatter.formatToParts(new Date(date));

  // // Separate date and time parts
  // for (const part of parts) {
  //   switch (part.type) {
  //     case "day":
  //       datePart += `${part.value}${ordinalSuffix(parseInt(part.value, 10))}`;
  //       break;
  //     case "month":
  //     case "year":
  //       datePart += part.value;
  //       break;
  //     case "hour":
  //     case "minute":
  //     case "dayPeriod":
  //       timePart += part.value;
  //       break;
  //     case "literal":
  //       timePart ? (timePart += part.value) : (datePart += " ");
  //       break;
  //   }
  // }

  // return `${datePart} @ ${timePart.trim()}`;
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    // minimumFractionDigits: 0,
    // maximumFractionDigits: 0,
  }).format(amount);
};

export function isBookingEditable(bookingStartDate: Date): boolean {
  const now = new Date();

  return (
    isAfter(bookingStartDate, now) &&
    bookingStartDate.getTime() - now.getTime() > 12 * 60 * 60 * 1000
  );
}

// --- Type Definitions (Assuming BookingLeg now has legStartTime and legEndTime) ---
type BookingWithDetailedLegs = Prisma.BookingGetPayload<{
  include: {
    legs: {
      include: {
        extensions: true;
      };
    };
  };
}>;

type LegWithDetails = BookingWithDetailedLegs["legs"][number];

// --- 1. Updated `getEffectiveLegEndTime` (No date-fns-tz) ---
/**
 * Calculates the effective end time for a specific booking leg.
 * IMPORTANT: Relies on the system's local timezone for date comparisons like isSameDay
 * and for the interpretation of endOfDay if no extensions dictate the time.
 * @param leg The BookingLeg object (must include legEndTime and extensions).
 * @returns The effective end time as a Date object.
 */
function getEffectiveLegEndTime(leg: LegWithDetails): Date {
  let effectiveEndTime = new Date(leg.legEndTime); // Base end time from the leg itself
  const activeExtensionStatuses = ["CONFIRMED", "ACTIVE"];

  const activeExtensions = leg.extensions.filter((ext) =>
    activeExtensionStatuses.includes(ext.status),
  );

  if (activeExtensions.length > 0) {
    const latestExtensionEndTime = activeExtensions.reduce((latestDate, currentExt) => {
      const currentEndTime = new Date(currentExt.extensionEndTime);
      return currentEndTime > latestDate ? currentEndTime : latestDate;
    }, new Date(0));

    if (latestExtensionEndTime.getTime() > effectiveEndTime.getTime()) {
      effectiveEndTime = latestExtensionEndTime;
    }
  }
  // If leg.legEndTime was already, for example, endOfDay for an intermediate leg,
  // or the specific booking.endDate time for the last leg, this logic is now simpler
  // as that information is directly on the leg.
  return effectiveEndTime;
}

// --- 3. Updated `getLegExtendableDuration` (No date-fns-tz) ---
/**
 * Calculates how many *full* hours the current day's booking leg can be extended.
 * **WARNING: Uses the system's local timezone for "today" and "midnight".**
 * **This will ONLY work correctly for London time if the server's timezone is 'Europe/London'.**
 * The maximum extension time is midnight (local time).
 *
 * @param booking - The booking object.
 * @returns number - The available extension duration in *full* hours, or 0.
 */
export function getLegExtendableDuration(booking: BookingWithDetailedLegs): number {
  if (booking.status !== "ACTIVE" || booking.paymentStatus !== "PAID" || booking.type !== "DAY") {
    return 0;
  }

  const now = new Date(); // parseISO("2025-05-23T18:37:44+01:00"); // 6:37:44 PM BST

  // --- Calculations based on local system timezone ---
  const today = startOfDay(now);
  const midnightToday = startOfDay(addDays(today, 1));

  const todaysLeg = booking.legs.find((leg) => isSameDay(new Date(leg.legDate), now));

  if (!todaysLeg) {
    return 0;
  }

  const effectiveEndTime = getEffectiveLegEndTime(todaysLeg);

  if (!isBefore(now, effectiveEndTime)) {
    return 0;
  }

  if (!isBefore(effectiveEndTime, midnightToday)) {
    return 0;
  }

  const durationInHours = differenceInHours(midnightToday, effectiveEndTime);

  return Math.max(0, durationInHours);
}

// Define an interface for the expected structure of guestUser JSON
interface GuestUserDetails {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  // Add any other fields you expect in the guestUser JSON
}

// Assuming 'booking' is an object that matches the Prisma Booking model structure,
// potentially with 'user' included. For guestUser, it would be Prisma.JsonValue.
// Example: const booking: Booking & { user: User | null; guestUser: Prisma.JsonValue | null } = yourBookingData;

export function getCustomerDetails(
  booking: Prisma.BookingGetPayload<{
    include: { user: true; guestUser: true };
  }>,
): { email: string; name: string; phone_number: string } {
  let email = "";
  let name = "";
  let phone_number = "";

  if (booking.user) {
    email = booking.user.email;
    name = booking.user.name ?? "";
    phone_number = booking.user.phoneNumber ?? "";
  } else if (
    booking.guestUser &&
    typeof booking.guestUser === "object" &&
    booking.guestUser !== null
  ) {
    // Type assertion is needed here because guestUser is Prisma.JsonValue
    // We assert it to an object matching our GuestUserDetails interface
    const guestDetails = booking.guestUser as GuestUserDetails;

    email = guestDetails.email ?? "";
    name = guestDetails.name ?? "";
    phone_number = guestDetails.phoneNumber ?? "";
  }

  return { email, name, phone_number };
}

// Helper to generate a user-friendly name or email
export function getUserDisplayName(
  booking: Omit<BookingWithRelations, "legs">,
  target: "user" | "owner" | "chauffeur" = "user",
): string {
  if (target === "user") {
    return (
      booking.user?.name ||
      booking.user?.username ||
      booking.user?.email ||
      booking.guestUser?.name ||
      booking.guestUser?.email ||
      "Customer"
    );
  }

  if (target === "owner") {
    return (
      booking.car.owner?.name ||
      booking.car.owner?.username ||
      booking.car.owner?.email ||
      "Fleet Owner"
    );
  }

  if (target === "chauffeur" && booking.chauffeur) {
    return booking.chauffeur.name || booking.chauffeur.email || "Chauffeur";
  }

  return "User";
}

export type NormalisedBookingDetails = {
  id: string;
  customerName: string;
  ownerName: string;
  chauffeurName: string;
  chauffeurPhoneNumber: string;
  carName: string;
  pickupLocation: string;
  returnLocation: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
  title: string;
  status: string;
  cancellationReason: string;
};

export type NormalisedExtensionDetails = {
  customerName: string;
  carName: string;
  legDate: string;
  extensionHours: number;
  from: string;
  to: string;
};

export type NormalisedBookingLegDetails = {
  bookingId: string;
  customerName: string;
  chauffeurName: string;
  legDate: string;
  legStartTime: string;
  legEndTime: string;
  chauffeurPhoneNumber: string;
  carName: string;
  pickupLocation: string;
  returnLocation: string;
};

export function normaliseBookingDetails(booking: BookingWithRelations): NormalisedBookingDetails {
  const customerName = getUserDisplayName(booking, "user");
  const ownerName = getUserDisplayName(booking, "owner");
  const chauffeurName = getUserDisplayName(booking, "chauffeur");
  const carName = `${booking.car.make} ${booking.car.model} (${booking.car.year})`;

  const { title, status } = match(booking.status)
    .with(BookingStatus.CONFIRMED, () => ({ title: "started", status: "active" }))
    .with(BookingStatus.ACTIVE, () => ({ title: "ended", status: "completed" }))
    .otherwise(() => ({
      title: `status is ${booking.status.toLowerCase()}`,
      status: booking.status.toLowerCase(),
    }));

  return {
    id: booking.id,
    ownerName,
    customerName,
    chauffeurName,
    chauffeurPhoneNumber: booking.chauffeur?.phoneNumber ?? "",
    carName,
    title,
    status,
    cancellationReason: booking.cancellationReason ?? "No reason provided",
    pickupLocation: booking.pickupLocation,
    returnLocation: booking.returnLocation,
    startDate: formatDate(booking.startDate),
    endDate: formatDate(booking.endDate),
    totalAmount: formatCurrency(Number(booking.totalAmount.toFixed(2))),
  };
}

export function normaliseExtensionDetails(extension: Extension): NormalisedExtensionDetails {
  const { booking } = extension.bookingLeg;
  const customerName = getUserDisplayName(booking as BookingWithRelations, "user");

  return {
    customerName,
    carName: `${booking.car.make} ${booking.car.model} (${booking.car.year})`,
    legDate: format(extension.bookingLeg.legDate, "PPPP"),
    extensionHours: extension.extendedDurationHours,
    from: format(extension.bookingLeg.legEndTime, "p"),
    to: format(extension.extensionEndTime, "p"),
  };
}

export function normaliseBookingLegDetails(
  bookingLeg: BookingLegWithRelations,
): NormalisedBookingLegDetails {
  const { booking } = bookingLeg;
  const customerName = getUserDisplayName(booking, "user");
  const chauffeurName = getUserDisplayName(booking, "chauffeur");
  const carName = `${booking.car.make} ${booking.car.model} (${booking.car.year})`;

  return {
    bookingId: booking.id,
    customerName,
    chauffeurName,
    legDate: format(bookingLeg.legDate, "PPPP"),
    legStartTime: format(bookingLeg.legStartTime, "p"),
    legEndTime: format(bookingLeg.legEndTime, "p"),
    chauffeurPhoneNumber: booking.chauffeur?.phoneNumber ?? "",
    pickupLocation: booking.pickupLocation,
    returnLocation: booking.returnLocation,
    carName,
  };
}
