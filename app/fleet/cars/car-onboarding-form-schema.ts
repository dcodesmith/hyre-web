import { z } from "zod";
import type { FleetVehicleVerification } from "~/api/fleet/cars/onboarding-schema";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const pdfSchema = z
  .file()
  .refine((file) => file.size > 0 && file.size <= MAX_FILE_SIZE_BYTES, "PDF must not exceed 5 MB")
  .refine((file) => file.type === "application/pdf", "Upload a PDF file");

const imageSchema = z
  .file()
  .refine((file) => file.size > 0 && file.size <= MAX_FILE_SIZE_BYTES, "Image must not exceed 5 MB")
  .refine((file) => IMAGE_TYPES.has(file.type), "Images must be JPEG, PNG, or WebP");

export const carOnboardingPlateFormSchema = z.object({
  plateNumber: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replaceAll(/\s+/g, ""))
    .refine(
      (value) => /^[A-Z]{3}-?\d{3}[A-Z]{2}$/.test(value) || /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(value),
      "Enter a valid Nigerian number plate",
    )
    .transform((value) => value.replace("-", "")),
});

export const carOnboardingDocumentsFormSchema = z.object({
  motCertificate: pdfSchema,
  insuranceCertificate: pdfSchema,
});

export const carOnboardingImagesFormSchema = z.object({
  images: z.array(imageSchema).min(1, "Upload at least one image").max(5, "Upload up to 5 images"),
});

function checkboxValue(value: unknown) {
  return value === true || value === "true" || value === "on";
}

function nullableInteger(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  return value;
}

export const carOnboardingPricingFormSchema = z
  .object({
    hourlyRate: z.coerce.number().int().positive(),
    dayRate: z.coerce.number().int().positive(),
    nightRate: z.coerce.number().int().positive(),
    fullDayRate: z.coerce.number().int().positive(),
    airportPickupRate: z.coerce.number().int().positive(),
    fuelUpgradeRate: z.preprocess(nullableInteger, z.coerce.number().int().positive().nullable()),
    pricingIncludesFuel: z.preprocess(checkboxValue, z.boolean()),
    vehicleType: z.enum(["SEDAN", "SUV", "VAN", "CROSSOVER"]),
    serviceTier: z.enum(["STANDARD", "EXECUTIVE", "LUXURY", "ULTRA_LUXURY"]),
  })
  .superRefine(({ fuelUpgradeRate, pricingIncludesFuel }, context) => {
    if (!pricingIncludesFuel && fuelUpgradeRate === null) {
      context.addIssue({
        code: "custom",
        message: "Fuel upgrade rate is required when pricing excludes fuel",
        path: ["fuelUpgradeRate"],
      });
    }
  });

export const carOnboardingInsuranceFormSchema = z.object({
  policyNumber: z.string().trim().min(3).max(100),
});

export type CarOnboardingPricing = z.output<typeof carOnboardingPricingFormSchema>;

export type NewFleetCarActionData = {
  readonly error?: string;
  readonly revalidate?: false;
  readonly verification?: FleetVehicleVerification;
};

export type FleetCarOnboardingActionData = {
  readonly error?: string;
  readonly revalidate?: false;
};
