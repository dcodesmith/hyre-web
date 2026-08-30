import { z } from "zod";

import { BOOKING_TYPE_OPTIONS } from "~/booking/types";

const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;

const PAYMENT_STATUSES = [
  "UNPAID",
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "REFUND_PROCESSING",
  "REFUND_FAILED",
] as const;

const FLIGHT_STATUSES = [
  "SCHEDULED",
  "DEPARTED",
  "EN_ROUTE",
  "LANDED",
  "CANCELLED",
  "DIVERTED",
  "UNKNOWN",
] as const;

const bookingStatusSchema = z.enum(BOOKING_STATUSES);
const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
const moneySchema = z.union([
  z.number(),
  z.string().trim().min(1).transform(Number).pipe(z.number()),
]);
const optionalMoneySchema = moneySchema.nullish();
const currencySchema = z
  .string()
  .trim()
  .transform((value) => (/^[A-Za-z]{3}$/.test(value) ? value.toUpperCase() : undefined))
  .nullish();
const isoDateSchema = z.union([z.string(), z.date()]).transform((value) => {
  return value instanceof Date ? value.toISOString() : value;
});

export const guestBookingAccessTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Invalid guest booking access token");

export const guestBookingAccessRequestResponseSchema = z.object({
  message: z.string(),
});

const guestBookingExtensionSchema = z.object({
  id: z.string(),
  extensionStartTime: isoDateSchema,
  extensionEndTime: isoDateSchema,
  extendedDurationHours: z.number().int(),
  status: z.string(),
  paymentStatus: paymentStatusSchema,
});

export const guestBookingDetailSchema = z.object({
  bookingId: z.string(),
  bookingReference: z.string(),
  status: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  bookingType: z.enum(BOOKING_TYPE_OPTIONS),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  pickupLocation: z.string(),
  returnLocation: z.string(),
  specialRequests: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  flightNumber: z.string().nullable(),
  totalAmount: moneySchema,
  currency: z.literal("NGN"),
  accessExpiresAt: isoDateSchema,
  car: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
    images: z.array(z.string()),
  }),
  chauffeur: z
    .object({
      name: z.string().nullable(),
      phoneNumber: z.string().nullable(),
    })
    .nullable(),
  legs: z.array(
    z.object({
      id: z.string(),
      legDate: isoDateSchema,
      legStartTime: isoDateSchema,
      legEndTime: isoDateSchema,
      extensions: z.array(guestBookingExtensionSchema),
    }),
  ),
});

const bookingListItemSchema = z
  .object({
    id: z.string(),
    bookingReference: z.string(),
    status: bookingStatusSchema,
    startDate: z.string(),
    endDate: z.string(),
    totalAmount: z.number(),
    currency: currencySchema,
    car: z.object({
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      images: z.array(z.object({ url: z.string() })),
    }),
    review: z.unknown().nullish(),
  })
  .transform(({ review, ...booking }) => ({
    ...booking,
    reviewed: review != null,
  }));

export const bookingsByStatusSchema = z
  .partialRecord(bookingStatusSchema, z.array(bookingListItemSchema))
  .refine((bookings) =>
    BOOKING_STATUSES.every((status) => {
      const rows = bookings[status];
      return rows == null || rows.every((row) => row.status === status);
    }),
  );

const bookingDetailExtensionSchema = z.object({
  id: z.string(),
  status: z.string(),
  paymentStatus: paymentStatusSchema,
  extendedDurationHours: z.number().int(),
  netTotal: optionalMoneySchema,
});

const bookingDetailLegSchema = z.object({
  id: z.string(),
  legDate: isoDateSchema,
  legStartTime: isoDateSchema,
  legEndTime: isoDateSchema,
  extensions: z.array(bookingDetailExtensionSchema).default([]),
  canExtend: z.boolean(),
  maxExtendableHours: z.number().int().min(0).max(24),
});

const bookingDetailFlightSchema = z.object({
  flightNumber: z.string(),
  flightDate: isoDateSchema,
  status: z.enum(FLIGHT_STATUSES),
  originCode: z.string(),
  originCodeIATA: z.string().nullish(),
  originName: z.string().nullish(),
  originCity: z.string().nullish(),
  destinationCode: z.string(),
  destinationCodeIATA: z.string().nullish(),
  destinationName: z.string().nullish(),
  destinationCity: z.string().nullish(),
  scheduledArrival: isoDateSchema,
  estimatedArrival: isoDateSchema.nullish(),
  actualArrival: isoDateSchema.nullish(),
  delayMinutes: z.number().int().nullish(),
  aircraftType: z.string().nullish(),
  registration: z.string().nullish(),
});

export const bookingDetailSchema = z.object({
  id: z.string(),
  bookingReference: z.string(),
  status: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  type: z.enum(BOOKING_TYPE_OPTIONS),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  pickupLocation: z.string(),
  returnLocation: z.string(),
  totalAmount: moneySchema,
  currency: currencySchema,
  netTotal: optionalMoneySchema,
  platformCustomerServiceFeeAmount: optionalMoneySchema,
  platformCustomerServiceFeeRatePercent: optionalMoneySchema,
  vatAmount: optionalMoneySchema,
  vatRatePercent: optionalMoneySchema,
  securityDetailCost: optionalMoneySchema,
  fuelUpgradeCost: optionalMoneySchema,
  referralDiscountAmount: optionalMoneySchema,
  referralCreditsUsed: optionalMoneySchema,
  car: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
  }),
  chauffeur: z
    .object({
      name: z.string().nullable(),
    })
    .nullish(),
  flight: bookingDetailFlightSchema.nullish(),
  legs: z.array(bookingDetailLegSchema),
  canEdit: z.boolean(),
  canCancel: z.boolean(),
  modificationCutoffAt: isoDateSchema,
});

export const bookingMutationResponseSchema = z.object({
  id: z.string(),
});

const bookingPricingPromotionSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  discountValue: z.number(),
  startDate: z.string().optional(),
  endDateExclusive: z.string().optional(),
});

const bookingPricingSegmentSchema = z.object({
  kind: z.enum(["PROMO", "STANDARD"]),
  units: z.number(),
  unitPrice: moneySchema,
  total: moneySchema,
  compareAtUnitPrice: moneySchema.nullable(),
  label: z.string().nullable(),
  promotion: bookingPricingPromotionSchema.nullable(),
});

export const bookingPricingPreviewSchema = z.object({
  currency: z.literal("NGN"),
  numberOfLegs: z.number().int(),
  discountCoverage: z.enum(["NONE", "PARTIAL", "FULL"]),
  segments: z.array(bookingPricingSegmentSchema),
  baseTotal: moneySchema,
  compareAtBaseTotal: moneySchema,
  securityDetailCost: moneySchema,
  fuelUpgradeCost: moneySchema,
  platformFeeRatePercent: moneySchema,
  platformFeeAmount: moneySchema,
  compareAtPlatformFeeAmount: moneySchema,
  subtotalBeforeDiscounts: moneySchema,
  compareAtSubtotalBeforeDiscounts: moneySchema,
  referralDiscountAmount: moneySchema,
  creditsUsed: moneySchema,
  subtotalAfterDiscounts: moneySchema,
  vatRatePercent: moneySchema,
  vatAmount: moneySchema,
  compareAtVatAmount: moneySchema,
  totalAmount: moneySchema,
  compareAtTotalAmount: moneySchema,
  savingsAmount: moneySchema,
});

export const createBookingResponseSchema = z.object({
  bookingId: z.string().min(1),
  txRef: z.string().min(1),
  checkoutUrl: z.url().refine((url) => new URL(url).protocol === "https:"),
  totalAmount: moneySchema,
  currency: z.literal("NGN"),
  bookingStatus: bookingStatusSchema,
  reservationExpiresAt: isoDateSchema,
  paymentStatusToken: z.string().min(1).optional(),
});

export const createExtensionResponseSchema = z.object({
  extensionId: z.string().min(1),
  paymentIntentId: z.string().min(1),
  checkoutUrl: z.url().refine((url) => new URL(url).protocol === "https:"),
});

export type BookingListItem = z.output<typeof bookingListItemSchema>;
export type BookingsByStatus = z.output<typeof bookingsByStatusSchema>;
export type BookingDetail = z.output<typeof bookingDetailSchema>;
export type BookingDetailLeg = z.output<typeof bookingDetailLegSchema>;
export type BookingDetailFlight = z.output<typeof bookingDetailFlightSchema>;
export type GuestBookingDetail = z.output<typeof guestBookingDetailSchema>;
export type BookingPricingSegment = z.output<typeof bookingPricingSegmentSchema>;
export type BookingPricingPreview = z.output<typeof bookingPricingPreviewSchema>;
export type CreateBookingResponse = z.output<typeof createBookingResponseSchema>;
export type CreateExtensionResponse = z.output<typeof createExtensionResponseSchema>;
