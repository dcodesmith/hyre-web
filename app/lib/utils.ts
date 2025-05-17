import { Booking, Extension } from "@prisma/client";
import { useFormAction, useNavigation } from "@remix-run/react";
import { type ClassValue, clsx } from "clsx";
import { isToday } from "date-fns";
import { twMerge } from "tailwind-merge";
import { BookingWithRelations } from "~/types";

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

export function isBookingEditable(startDate: Date) {
  const now = new Date();
  const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilStart > 6;
}

export function isBookingExtendable(booking: BookingWithRelations) {
  return (
    booking.status === "ACTIVE" &&
    booking.type === "DAY" &&
    booking.extensions?.some((extension) => isToday(extension.endDate))
  );
}
