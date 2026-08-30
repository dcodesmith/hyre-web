import { z } from "zod";

export const bookingPaymentStatusSchema = z.object({
  bookingId: z.string(),
  bookingReference: z.string(),
  txRef: z.string(),
  bookingStatus: z.string(),
  paymentStatus: z.string(),
  paymentId: z.string().nullable(),
  totalAmount: z.number(),
  reservationExpiresAt: z.string().nullable(),
  lifecycleState: z.enum(["PENDING", "VERIFYING", "CONFIRMED", "FAILED", "EXPIRED"]),
});

export const extensionPaymentStatusSchema = z.object({
  txRef: z.string(),
  status: z.string(),
  amountExpected: z.number(),
  amountCharged: z.number().nullable(),
  confirmedAt: z.string().nullable(),
  extension: z.object({
    id: z.string(),
    status: z.string(),
  }),
});

export type BookingPaymentStatus = z.output<typeof bookingPaymentStatusSchema>;
export type ExtensionPaymentStatus = z.output<typeof extensionPaymentStatusSchema>;
