import { z } from "zod";

const providerVerificationStatusSchema = z.enum([
  "PROCESSING",
  "SUCCEEDED",
  "REVIEW_REQUIRED",
  "FAILED",
]);

export const fleetVehicleVerificationSchema = z.object({
  id: z.uuid(),
  status: providerVerificationStatusSchema,
  vehicle: z.object({
    plateNumber: z.string(),
    chassisNumber: z.string().nullable(),
    make: z.string().nullable(),
    model: z.string().nullable(),
    year: z.number().int().nullable(),
    color: z.string().nullable(),
    passengerCapacity: z.number().int().nullable(),
  }),
  eligibility: z.object({
    isEligible: z.boolean(),
    reasons: z.array(z.enum(["VEHICLE_YEAR_BELOW_MINIMUM"])),
    minimumYear: z.number().int(),
  }),
  expiresAt: z.iso.datetime(),
  carId: z.uuid().nullable(),
});

export const fleetDraftCarCreatedSchema = z.object({
  id: z.uuid(),
});

export const fleetCarSubmissionSchema = z.object({
  success: z.literal(true),
  requirements: z.object({
    hasDocuments: z.boolean(),
    hasImages: z.boolean(),
    hasPricing: z.boolean(),
  }),
});

export type FleetVehicleVerification = z.output<typeof fleetVehicleVerificationSchema>;
