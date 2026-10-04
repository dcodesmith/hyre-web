import { z } from "zod";
import { BOOKING_TYPE_OPTIONS } from "~/booking/types";

export const fleetBookingStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
]);

const chauffeurSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  image: z.string().nullable(),
});

export const fleetBookingSchema = z.object({
  id: z.uuid(),
  bookingReference: z.string(),
  status: fleetBookingStatusSchema,
  type: z.enum(BOOKING_TYPE_OPTIONS),
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  pickupLocation: z.string(),
  returnLocation: z.string(),
  specialRequests: z.string().nullable(),
  flightNumber: z.string().nullable(),
  customerName: z.string(),
  car: z.object({
    id: z.uuid(),
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
    registrationNumber: z.string(),
  }),
  chauffeur: chauffeurSchema.nullable(),
  canAssignChauffeur: z.boolean(),
});

export const fleetBookingsSchema = z.object({
  items: z.array(fleetBookingSchema),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const fleetBookingDetailSchema = z.object({
  booking: fleetBookingSchema,
  assignableChauffeurs: z.array(
    chauffeurSchema.extend({
      isOwnerDriver: z.boolean(),
    }),
  ),
});

export const fleetBookingAssignmentSchema = z.object({
  id: z.uuid(),
  chauffeur: z.object({ id: z.uuid() }).nullable(),
});

export type FleetBooking = z.output<typeof fleetBookingSchema>;
export type FleetBookingDetail = z.output<typeof fleetBookingDetailSchema>;
export type FleetBookingStatus = z.output<typeof fleetBookingStatusSchema>;
