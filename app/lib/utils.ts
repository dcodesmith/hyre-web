import { Booking, Extension, BookingStatus, PaymentStatus, BookingType } from "@prisma/client";
import { useFormAction, useNavigation } from "@remix-run/react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { BookingWithRelations } from "~/types";
import {
  isSameDay,
  startOfDay,
  endOfDay,
  set,
  isBefore,
  isAfter,
  getHours,
  getMinutes,
  getSeconds,
  getMilliseconds,
  parseISO,
  differenceInHours,
} from "date-fns";

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

export const getOrdinalSuffix = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

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
  const bookingStart = new Date(bookingStartDate);
  return isAfter(bookingStart, now) && bookingStart.getTime() - now.getTime() > 24 * 60 * 60 * 1000;
}

export function isBookingExtendable(booking: BookingWithRelations): boolean {
  if (booking.status !== "ACTIVE" || booking.paymentStatus !== "PAID" || booking.type !== "DAY") {
    return false;
  }

  const now = new Date();
  const today = startOfDay(now);
  const midnightToday = endOfDay(today);

  const overallBookingStartDate = parseISO(booking.startDate as unknown as string);
  const overallBookingEndDate = parseISO(booking.endDate as unknown as string);

  if (
    isBefore(today, startOfDay(overallBookingStartDate)) ||
    isAfter(today, startOfDay(overallBookingEndDate))
  ) {
    return false;
  }

  if (!isBefore(now, overallBookingEndDate)) {
    return false;
  }

  let currentEffectiveEndTimeForToday: Date;

  const activeExtensionForToday = booking.extensions?.find(
    (ext) =>
      ext.day &&
      isSameDay(parseISO(ext.day as unknown as string), today) &&
      ext.status === "ACTIVE" &&
      ext.paymentStatus === "PAID",
  );

  if (activeExtensionForToday?.endDate) {
    currentEffectiveEndTimeForToday = parseISO(
      activeExtensionForToday.endDate as unknown as string,
    );
  } else {
    currentEffectiveEndTimeForToday = set(today, {
      hours: getHours(overallBookingEndDate),
      minutes: getMinutes(overallBookingEndDate),
      seconds: getSeconds(overallBookingEndDate),
      milliseconds: getMilliseconds(overallBookingEndDate),
    });
  }

  if (!isBefore(now, currentEffectiveEndTimeForToday)) {
    return false;
  }

  if (!isBefore(currentEffectiveEndTimeForToday, midnightToday)) {
    return false;
  }

  return true;
}

// implement a function to return a boooking for today thats extendable and the max hours it can be extended to
export function getMaxHoursExtendable(booking: BookingWithRelations) {
  const now = new Date();
  const today = startOfDay(now);
  const midnightToday = endOfDay(today);

  const overallBookingStartDate = parseISO(booking.startDate as unknown as string);
  const overallBookingEndDate = parseISO(booking.endDate as unknown as string);

  // Check if today is within the booking period
  if (
    isBefore(today, startOfDay(overallBookingStartDate)) ||
    isAfter(today, startOfDay(overallBookingEndDate))
  ) {
    return 0;
  }

  // For multi-day bookings, we need to determine the effective end time for today
  let currentEffectiveEndTimeForToday: Date;

  // Check if there's an active extension for today
  const activeExtensionForToday = booking.extensions?.find(
    (ext) =>
      ext.day &&
      isSameDay(parseISO(ext.day as unknown as string), today) &&
      ext.status === "ACTIVE" &&
      ext.paymentStatus === "PAID",
  );

  if (activeExtensionForToday?.endDate) {
    // If there's an active extension, use its end date
    currentEffectiveEndTimeForToday = parseISO(
      activeExtensionForToday.endDate as unknown as string,
    );
  } else {
    // If today is the last day of the booking, use the booking's end time
    if (isSameDay(today, startOfDay(overallBookingEndDate))) {
      currentEffectiveEndTimeForToday = overallBookingEndDate;
    } else {
      // For any other day in a multi-day booking, use midnight as the effective end time
      currentEffectiveEndTimeForToday = midnightToday;
    }
  }

  // Check if the current time is already past the effective end time for today
  if (!isBefore(now, currentEffectiveEndTimeForToday)) {
    return 0;
  }

  // Get the hour of the end time in UTC
  const endHour = currentEffectiveEndTimeForToday.getUTCHours();

  // Calculate hours until 23:00 UTC (23 - endHour)
  const hoursUntilElevenPM = 23 - endHour;

  return hoursUntilElevenPM;
}
