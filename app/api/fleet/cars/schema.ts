import { z } from "zod";

export const fleetCarStatusSchema = z.enum(["AVAILABLE", "BOOKED", "HOLD", "IN_SERVICE"]);
export const fleetCarApprovalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const fleetCarDocumentStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const fleetCarDocumentTypeSchema = z.enum(["MOT_CERTIFICATE", "INSURANCE_CERTIFICATE"]);
export const fleetCarVehicleTypeSchema = z.enum(["SEDAN", "SUV", "VAN", "CROSSOVER"]);
export const fleetCarServiceTierSchema = z.enum([
  "STANDARD",
  "EXECUTIVE",
  "LUXURY",
  "ULTRA_LUXURY",
]);

const fleetCarImageSchema = z.object({
  id: z.string(),
  url: z.url(),
  status: fleetCarDocumentStatusSchema,
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const fleetCarDocumentSchema = z.object({
  id: z.string(),
  documentType: fleetCarDocumentTypeSchema,
  status: fleetCarDocumentStatusSchema,
  documentUrl: z.url(),
  notes: z.string().nullable(),
  approvedById: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  carId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  userId: z.string().nullable(),
});

export const fleetCarSchema = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  color: z.string(),
  ownerId: z.string(),
  registrationNumber: z.string(),
  status: fleetCarStatusSchema,
  approvalStatus: fleetCarApprovalStatusSchema,
  approvalNotes: z.string().nullable(),
  hourlyRate: z.number().int(),
  dayRate: z.number().int(),
  nightRate: z.number().int(),
  fuelUpgradeRate: z.number().int().nullable(),
  fullDayRate: z.number().int(),
  airportPickupRate: z.number().int(),
  vehicleType: fleetCarVehicleTypeSchema,
  serviceTier: fleetCarServiceTierSchema,
  passengerCapacity: z.number().int(),
  pricingIncludesFuel: z.boolean(),
  owner: z.object({
    id: z.string(),
    name: z.string().nullable(),
    username: z.string().nullable(),
    email: z.email(),
  }),
  images: z.array(fleetCarImageSchema),
  documents: z.array(fleetCarDocumentSchema),
  promotion: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      discountValue: z.number(),
    })
    .nullable(),
});

export const fleetCarsSchema = z.array(fleetCarSchema);

const fleetCarReplacementRecordSchema = z.object({
  id: z.string(),
  status: z.literal("PENDING"),
});

export const replaceFleetCarImageResponseSchema = z.object({
  success: z.literal(true),
  image: fleetCarReplacementRecordSchema,
});

export const replaceFleetCarDocumentResponseSchema = z.object({
  success: z.literal(true),
  document: fleetCarReplacementRecordSchema,
});

export type FleetCar = z.output<typeof fleetCarSchema>;
export type FleetCarApprovalStatus = z.output<typeof fleetCarApprovalStatusSchema>;
export type FleetCarDocumentStatus = z.output<typeof fleetCarDocumentStatusSchema>;
export type FleetCarStatus = z.output<typeof fleetCarStatusSchema>;
