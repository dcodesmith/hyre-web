import { z } from "zod";
import { BOOKING_TYPE_OPTIONS, DAY_BOOKING_TYPE, FULL_DAY_BOOKING_TYPE } from "../bookingTypes";

const coreBookingFields = z.object({
  carId: z.string(),
  pickupTime: z.string().optional(),
  pickupAddress: z
    .string({ required_error: "Pickup address is required" })
    .min(1, "Pickup address is required"),
  bookingType: z.enum(BOOKING_TYPE_OPTIONS),
});

const dropOffSchema = z.object({
  dropOffAddress: z
    .string({ required_error: "Drop-off address is required" })
    .min(1, "Drop-off address is required"),
});

const guestInfoSchema = z.object({
  email: z.string({ required_error: "Email is required" }).email("Invalid email address"),
  name: z
    .string({ required_error: "Name is required" })
    .min(2, "Name must be at least 2 characters"),
  phoneNumber: z
    .string({ required_error: "Phone number is required" })
    .min(10, "Phone must be at least 10 digits"),
});

const bookingSchemaSameLocation = coreBookingFields.extend({
  sameLocation: z.literal("true"),
});

const bookingSchemaDifferentLocation = coreBookingFields
  .extend({
    sameLocation: z.literal("false"),
  })
  .extend(dropOffSchema.shape);

const guestSchemaSameLocation = bookingSchemaSameLocation.extend(guestInfoSchema.shape);
const guestSchemaDifferentLocation = bookingSchemaDifferentLocation.extend(guestInfoSchema.shape);

const loggedInUserBookingSchema = z.discriminatedUnion("sameLocation", [
  bookingSchemaSameLocation,
  bookingSchemaDifferentLocation,
]);

const guestUserBookingSchema = z.discriminatedUnion("sameLocation", [
  guestSchemaSameLocation,
  guestSchemaDifferentLocation,
]);

/**
 * Returns the appropriate booking schema based on guest status
 * with validation for required pickup time on DAY and FULL_DAY bookings
 */
export function getBookingSchema(isGuestBooking: boolean) {
  const baseSchema = isGuestBooking ? guestUserBookingSchema : loggedInUserBookingSchema;

  return baseSchema.superRefine((data, ctx) => {
    if (
      (data.bookingType === DAY_BOOKING_TYPE || data.bookingType === FULL_DAY_BOOKING_TYPE) &&
      (!data.pickupTime || data.pickupTime.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pickup time is required for daytime and full day bookings",
        path: ["pickupTime"],
      });
    }
  });
}
