import { z } from "zod";

export const guestBookingFormSchema = z.object({
  bookingReference: z
    .string()
    .trim()
    .min(1, "Enter your booking reference.")
    .max(64, "Booking reference is too long.")
    .transform((value) => value.toUpperCase()),
  email: z
    .string()
    .trim()
    .pipe(z.email("Enter a valid email address."))
    .transform((value) => value.toLowerCase()),
});
