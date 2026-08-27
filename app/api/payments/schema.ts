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

export type BookingPaymentStatus = z.output<typeof bookingPaymentStatusSchema>;
