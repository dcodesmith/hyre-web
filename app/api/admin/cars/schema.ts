import { z } from "zod";

export const adminCarApprovalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const adminCarStatusSchema = z.enum(["AVAILABLE", "BOOKED", "HOLD", "IN_SERVICE"]);
export const adminCarAssetStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const adminCarDocumentTypeSchema = z.enum(["MOT_CERTIFICATE", "INSURANCE_CERTIFICATE"]);
export const adminCarVehicleTypeSchema = z.enum(["SEDAN", "SUV", "VAN", "CROSSOVER"]);
export const adminCarServiceTierSchema = z.enum([
  "STANDARD",
  "EXECUTIVE",
  "LUXURY",
  "ULTRA_LUXURY",
]);

const adminCarImageSchema = z.object({
  id: z.string(),
  url: z.url(),
  status: adminCarAssetStatusSchema,
  isPrimary: z.boolean(),
  notes: z.string().nullable(),
  approvedById: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const adminCarDocumentSchema = z.object({
  id: z.string(),
  documentType: adminCarDocumentTypeSchema,
  status: adminCarAssetStatusSchema,
  documentUrl: z.string().min(1),
  notes: z.string().nullable(),
  approvedById: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  carId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  userId: z.string().nullable(),
});

export const adminCarSchema = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  color: z.string(),
  ownerId: z.string(),
  registrationNumber: z.string(),
  status: adminCarStatusSchema,
  approvalStatus: adminCarApprovalStatusSchema,
  approvalNotes: z.string().nullable(),
  hourlyRate: z.number().int(),
  dayRate: z.number().int(),
  nightRate: z.number().int(),
  fuelUpgradeRate: z.number().int().nullable(),
  fullDayRate: z.number().int(),
  airportPickupRate: z.number().int(),
  vehicleType: adminCarVehicleTypeSchema,
  serviceTier: adminCarServiceTierSchema,
  passengerCapacity: z.number().int(),
  pricingIncludesFuel: z.boolean(),
  owner: z.object({
    id: z.string(),
    name: z.string().nullable(),
    username: z.string().nullable(),
    email: z.email(),
  }),
  images: z.array(adminCarImageSchema),
  documents: z.array(adminCarDocumentSchema),
});

export const adminCarsResponseSchema = z.object({
  cars: z.array(adminCarSchema),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export const adminCarMutationResponseSchema = z.object({
  success: z.literal(true),
});

export type AdminCar = z.output<typeof adminCarSchema>;
export type AdminCarApprovalStatus = z.output<typeof adminCarApprovalStatusSchema>;
export type AdminCarAssetStatus = z.output<typeof adminCarAssetStatusSchema>;
export type AdminCarsResponse = z.output<typeof adminCarsResponseSchema>;
