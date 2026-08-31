import { z } from "zod";

export const BOOKING_REFERENCE_ERROR = "Enter your booking reference.";
export const GUEST_EMAIL_ERROR = "Enter a valid email address.";

export const guestBookingFormSchema = z.object({
  bookingReference: z
    .string({ error: BOOKING_REFERENCE_ERROR })
    .trim()
    .min(1, BOOKING_REFERENCE_ERROR)
    .max(64, "Booking reference is too long.")
    .transform((value) => value.toUpperCase()),
  email: z
    .string({ error: GUEST_EMAIL_ERROR })
    .trim()
    .pipe(z.email(GUEST_EMAIL_ERROR))
    .transform((value) => value.toLowerCase()),
});
