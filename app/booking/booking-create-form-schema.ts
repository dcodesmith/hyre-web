import { z } from "zod";

import { EMAIL_INVALID_ERROR } from "~/auth/auth-form-schema";
import { normalizeFlightNumber } from "~/booking/airport-pickup";
import { parsePickupClock } from "~/booking/pickup";
import {
  AIRPORT_PICKUP_BOOKING_TYPE,
  BOOKING_TYPE_OPTIONS,
  type BookingType,
  DAY_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  NIGHT_BOOKING_TYPE,
} from "~/booking/types";
import { parseZonedCalendarDate, zonedDateAt } from "~/time/timezone";

export const GUEST_NAME_ERROR = "Name must be at least 2 characters";
export const GUEST_PHONE_ERROR = "Phone must be at least 10 digits";
export const PICKUP_TIME_ERROR = "Please select a pickup time";
export const FLIGHT_NUMBER_ERROR = "Flight number is required for airport pickup bookings.";
export const PICKUP_ADDRESS_ERROR = "Pickup address is required.";
export const DROP_OFF_ADDRESS_ERROR = "Drop-off address is required.";
export const BOOKING_DATES_ERROR = "Please select booking dates";

export const NIGHT_PICKUP_TIME = "11 PM";
export const AIRPORT_PICKUP_TIME = "9 AM";

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

const calendarDateSchema = z
  .string({ error: BOOKING_DATES_ERROR })
  .regex(CALENDAR_DATE, BOOKING_DATES_ERROR)
  .refine((value) => parseZonedCalendarDate(value) != null, BOOKING_DATES_ERROR);

const guestInfoSchema = z.object({
  name: z.string({ error: GUEST_NAME_ERROR }).trim().min(2, GUEST_NAME_ERROR).max(200),
  email: z
    .string({ error: EMAIL_INVALID_ERROR })
    .trim()
    .toLowerCase()
    .pipe(z.email(EMAIL_INVALID_ERROR)),
  phoneNumber: z.string({ error: GUEST_PHONE_ERROR }).trim().min(10, GUEST_PHONE_ERROR).max(32),
});

function addGuestIssues(
  ctx: z.RefinementCtx,
  data: { name?: string; email?: string; phoneNumber?: string },
) {
  const guest = guestInfoSchema.safeParse({
    name: data.name ?? "",
    email: data.email ?? "",
    phoneNumber: data.phoneNumber ?? "",
  });

  if (guest.success) {
    return guest.data;
  }

  for (const issue of guest.error.issues) {
    ctx.addIssue({
      code: "custom",
      message: issue.message,
      path: issue.path,
    });
  }

  return null;
}

function buildBookingFormSchema(isGuest: boolean) {
  return z
    .object({
      carId: z.string({ error: "Car ID is required" }).trim().min(1, "Car ID is required"),
      idempotencyKey: z.uuid("Please retry this booking."),
      expectedTotalAmount: z
        .string({ error: "Confirm the current price before paying." })
        .trim()
        .regex(/^\d+(?:\.\d{1,2})?$/, "Confirm the current price before paying."),
      bookingType: z.enum(BOOKING_TYPE_OPTIONS),
      from: calendarDateSchema,
      to: calendarDateSchema,
      pickupTime: z.string().optional(),
      flightNumber: z.string().optional(),
      pickupAddress: z.string().trim().max(256).optional(),
      dropOffAddress: z.string().optional(),
      sameLocation: z.enum(["true", "false"]),
      name: z.string().optional(),
      email: z.string().optional(),
      phoneNumber: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.pickupAddress?.trim()) {
        ctx.addIssue({ code: "custom", message: PICKUP_ADDRESS_ERROR, path: ["pickupAddress"] });
      }

      if (
        (data.bookingType === DAY_BOOKING_TYPE || data.bookingType === FULL_DAY_BOOKING_TYPE) &&
        !data.pickupTime?.trim()
      ) {
        ctx.addIssue({ code: "custom", message: PICKUP_TIME_ERROR, path: ["pickupTime"] });
      }

      if (data.bookingType === AIRPORT_PICKUP_BOOKING_TYPE && !data.flightNumber?.trim()) {
        ctx.addIssue({ code: "custom", message: FLIGHT_NUMBER_ERROR, path: ["flightNumber"] });
      }

      if (data.bookingType === AIRPORT_PICKUP_BOOKING_TYPE && data.sameLocation !== "false") {
        ctx.addIssue({
          code: "custom",
          message: "Airport pickup bookings require a different drop-off location",
          path: ["sameLocation"],
        });
      }

      const needsLaterTo =
        data.bookingType === NIGHT_BOOKING_TYPE || data.bookingType === FULL_DAY_BOOKING_TYPE;
      if (needsLaterTo ? data.to <= data.from : data.to < data.from) {
        ctx.addIssue({
          code: "custom",
          message: "Drop-off date cannot be earlier than pickup date",
          path: ["to"],
        });
      }

      if (data.sameLocation === "false" && !data.dropOffAddress?.trim()) {
        ctx.addIssue({ code: "custom", message: DROP_OFF_ADDRESS_ERROR, path: ["dropOffAddress"] });
      }

      if (isGuest) {
        addGuestIssues(ctx, data);
      }
    })
    .transform((data) => {
      const pickupAddress = data.pickupAddress ?? "";

      if (!isGuest) {
        const booking = { ...data };
        delete booking.name;
        delete booking.email;
        delete booking.phoneNumber;
        return { ...booking, pickupAddress };
      }

      const guest = guestInfoSchema.parse({
        name: data.name ?? "",
        email: data.email ?? "",
        phoneNumber: data.phoneNumber ?? "",
      });

      return { ...data, ...guest, pickupAddress };
    });
}

const signedInBookingFormSchema = buildBookingFormSchema(false);
const guestBookingFormSchema = buildBookingFormSchema(true);

export function createBookingFormSchema(isGuest: boolean) {
  return isGuest ? guestBookingFormSchema : signedInBookingFormSchema;
}

export type CreateBookingFormValue = z.output<ReturnType<typeof createBookingFormSchema>>;

export function resolveCreatePickupTime(bookingType: BookingType, pickupTime: string | undefined) {
  if (bookingType === NIGHT_BOOKING_TYPE) {
    return NIGHT_PICKUP_TIME;
  }

  const trimmed = pickupTime?.trim();

  if (trimmed) {
    return trimmed;
  }

  return bookingType === AIRPORT_PICKUP_BOOKING_TYPE ? AIRPORT_PICKUP_TIME : "";
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

type BookingWindowInput = Pick<
  CreateBookingFormValue,
  "bookingType" | "from" | "to" | "pickupTime"
>;

function calendarDaySpan(from: string, to: string) {
  const start = parseZonedCalendarDate(from);
  const end = parseZonedCalendarDate(to);

  if (!start || !end) {
    return null;
  }

  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function toIsoWindow(start: Date, end: Date) {
  if (end <= start) {
    return null;
  }

  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function pickupAt(calendarDate: string, bookingType: BookingType, pickupTime: string | undefined) {
  const clock = parsePickupClock(resolveCreatePickupTime(bookingType, pickupTime));
  return clock ? zonedDateAt(calendarDate, clock.hour, clock.minute) : undefined;
}

function dayApiWindow(value: BookingWindowInput) {
  const clock = parsePickupClock(resolveCreatePickupTime(value.bookingType, value.pickupTime));
  const pickup = clock ? zonedDateAt(value.from, clock.hour, clock.minute) : undefined;
  const dropOffStart = clock ? zonedDateAt(value.to, clock.hour, clock.minute) : undefined;

  if (!pickup || !dropOffStart) {
    return null;
  }

  const dropOff = new Date(dropOffStart.getTime() + 12 * MS_PER_HOUR);
  return toIsoWindow(pickup, dropOff);
}

function nightApiWindow(value: BookingWindowInput) {
  const pickup = zonedDateAt(value.from, 23, 0);
  const dropOff = zonedDateAt(value.to, 5, 0);

  if (!pickup || !dropOff) {
    return null;
  }

  const nightEnd = dropOff <= pickup ? new Date(dropOff.getTime() + MS_PER_DAY) : dropOff;
  return toIsoWindow(pickup, nightEnd);
}

function fullDayApiWindow(value: BookingWindowInput) {
  const pickup = pickupAt(value.from, value.bookingType, value.pickupTime);
  const daySpan = calendarDaySpan(value.from, value.to);

  if (!pickup || daySpan == null) {
    return null;
  }

  return toIsoWindow(pickup, new Date(pickup.getTime() + 24 * Math.max(1, daySpan) * MS_PER_HOUR));
}

function airportApiWindow(value: BookingWindowInput) {
  const start = parseZonedCalendarDate(value.from);
  const endDay = parseZonedCalendarDate(value.to);

  if (!start || !endDay) {
    return null;
  }

  const end = value.from === value.to ? new Date(start.getTime() + MS_PER_DAY) : endDay;
  return toIsoWindow(start, end);
}

export function toBookingApiWindow(value: BookingWindowInput) {
  switch (value.bookingType) {
    case DAY_BOOKING_TYPE:
      return dayApiWindow(value);
    case NIGHT_BOOKING_TYPE:
      return nightApiWindow(value);
    case FULL_DAY_BOOKING_TYPE:
      return fullDayApiWindow(value);
    default:
      return airportApiWindow(value);
  }
}

export type BookingPricingInput = BookingWindowInput & {
  readonly carId: string;
};

export function toPricingPreviewBody(value: BookingPricingInput) {
  const window = toBookingApiWindow(value);

  if (!window) {
    return null;
  }

  return {
    carId: value.carId,
    bookingType: value.bookingType,
    startDate: window.startDate,
    endDate: window.endDate,
    pickupTime: resolveCreatePickupTime(value.bookingType, value.pickupTime),
    includeSecurityDetail: false,
    requiresFullTank: false,
    useCredits: 0,
  };
}

export function toCreateBookingBody(
  value: CreateBookingFormValue,
  expectedTotalAmount = value.expectedTotalAmount,
) {
  const preview = toPricingPreviewBody(value);

  if (!preview?.pickupTime) {
    return null;
  }

  const sameLocation = value.sameLocation === "true";
  const body: Record<string, unknown> = {
    ...preview,
    pickupAddress: value.pickupAddress,
    sameLocation,
    expectedTotalAmount,
  };

  if (!sameLocation) {
    body.dropOffAddress = value.dropOffAddress;
  }

  if (value.bookingType === AIRPORT_PICKUP_BOOKING_TYPE && value.flightNumber) {
    body.flightNumber = normalizeFlightNumber(value.flightNumber);
  }

  if (value.name && value.email && value.phoneNumber) {
    body.guestName = value.name;
    body.guestEmail = value.email;
    body.guestPhone = value.phoneNumber;
  }

  return body;
}
