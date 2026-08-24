import { z } from "zod";

const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;

const bookingStatusSchema = z.enum(BOOKING_STATUSES);

const bookingListItemSchema = z
  .object({
    id: z.string(),
    bookingReference: z.string(),
    status: bookingStatusSchema,
    startDate: z.string(),
    endDate: z.string(),
    totalAmount: z.number(),
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

export type BookingListItem = z.output<typeof bookingListItemSchema>;
export type BookingsByStatus = z.output<typeof bookingsByStatusSchema>;
