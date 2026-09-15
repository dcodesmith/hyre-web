import { z } from "zod";

export const fleetCarStatusSchema = z.enum(["AVAILABLE", "BOOKED", "HOLD", "IN_SERVICE"]);
export const fleetCarApprovalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const fleetCarDocumentStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const fleetCarDocumentTypeSchema = z.enum([
  "VEHICLE_REGISTRATION",
  "MOT_CERTIFICATE",
  "INSURANCE_CERTIFICATE",
]);
export const fleetCarVehicleTypeSchema = z.enum(["SEDAN", "SUV", "VAN", "CROSSOVER"]);
export const fleetCarServiceTierSchema = z.enum([
  "STANDARD",
  "EXECUTIVE",
  "LUXURY",
  "ULTRA_LUXURY",
]);
const providerVerificationStatusSchema = z.enum([
  "PROCESSING",
  "SUCCEEDED",
  "REVIEW_REQUIRED",
  "FAILED",
]);

const fleetCarImageSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  status: fleetCarDocumentStatusSchema,
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const fleetCarDocumentSchema = z.object({
  id: z.uuid(),
  documentType: fleetCarDocumentTypeSchema,
  status: fleetCarDocumentStatusSchema,
  documentUrl: z.url(),
  notes: z.string().nullable(),
  approvedById: z.uuid().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  carId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  userId: z.uuid().nullable(),
});

export const fleetCarSchema = z.object({
  id: z.uuid(),
  publicRef: z.string().regex(/^[0-9a-f]{16}$/),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  color: z.string(),
  ownerId: z.uuid(),
  registrationNumber: z.string(),
  status: fleetCarStatusSchema,
  approvalStatus: fleetCarApprovalStatusSchema,
  approvalNotes: z.string().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  hourlyRate: z.number().int().nullable(),
  dayRate: z.number().int().nullable(),
  nightRate: z.number().int().nullable(),
  fuelUpgradeRate: z.number().int().nullable(),
  fullDayRate: z.number().int().nullable(),
  airportPickupRate: z.number().int().nullable(),
  vehicleType: fleetCarVehicleTypeSchema,
  serviceTier: fleetCarServiceTierSchema,
  passengerCapacity: z.number().int(),
  pricingIncludesFuel: z.boolean(),
  owner: z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    username: z.string().nullable(),
    email: z.email(),
  }),
  images: z.array(fleetCarImageSchema),
  documents: z.array(fleetCarDocumentSchema),
  insuranceVerifications: z
    .array(
      z.object({
        id: z.uuid(),
        status: providerVerificationStatusSchema,
        policyNumber: z.string(),
        policyStatus: z.string().nullable(),
        policyExpiresAt: z.iso.datetime().nullable(),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(1),
  promotion: z
    .object({
      id: z.uuid(),
      name: z.string().nullable(),
      discountValue: z.number(),
    })
    .nullable(),
});

export const fleetCarsSchema = z.array(fleetCarSchema);

const fleetCarReplacementRecordSchema = z.object({
  id: z.uuid(),
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
