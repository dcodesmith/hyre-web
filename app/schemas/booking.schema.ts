import { z } from "zod";
import {
  BOOKING_TYPE_OPTIONS,
  DAY_BOOKING_TYPE,
  FULL_DAY_BOOKING_TYPE,
  AIRPORT_PICKUP_BOOKING_TYPE,
} from "~/components/bookingTypes";

const coreBookingFields = z.object({
  carId: z
    .string({
      error: "Car ID is required.",
    })
    .min(1, "Car ID cannot be empty"),
  pickupTime: z.string().optional(),
  flightNumber: z.string().optional(),
  pickupAddress: z
    .string({
      error: "Pickup address is required.",
    })
    .min(1, "Pickup address cannot be empty"),
  bookingType: z.enum(BOOKING_TYPE_OPTIONS, {
    error: "Booking type is required and must be valid.",
  }),
});

const dropOffSchema = z.object({
  dropOffAddress: z
    .string({
      error: "Drop-off address is required.",
    })
    .min(1, "Drop-off address cannot be empty"),
});

const guestInfoSchema = z.object({
  email: z.email("Email address is not valid."),
  name: z
    .string({
      error: "Name is required.",
    })
    .min(2, "Name must be at least 2 characters"),
  phoneNumber: z
    .string({
      error: "Phone number is required.",
    })
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
 * and required flight number for AIRPORT_PICKUP bookings
 */
export function getBookingSchema(isGuestBooking: boolean) {
  const baseSchema = isGuestBooking ? guestUserBookingSchema : loggedInUserBookingSchema;

  return baseSchema
    .refine(
      (data) => {
        if (data.bookingType === DAY_BOOKING_TYPE || data.bookingType === FULL_DAY_BOOKING_TYPE) {
          return typeof data.pickupTime === "string" && data.pickupTime.trim() !== "";
        }
        return true;
      },
      {
        message: "Pickup time is required for daytime and full day bookings.",
        path: ["pickupTime"],
      },
    )
    .refine(
      (data) => {
        if (data.bookingType === AIRPORT_PICKUP_BOOKING_TYPE) {
          return typeof data.flightNumber === "string" && data.flightNumber.trim() !== "";
        }
        return true;
      },
      {
        message: "Flight number is required for airport pickup bookings.",
        path: ["flightNumber"],
      },
    );
}
