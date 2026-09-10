import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";
import type { FleetVehicleVerification } from "~/api/fleet/cars/onboarding-schema";
import { addFileValidationIssues } from "~/components/forms/file-validation";
import { MIN_FLEET_CAR_IMAGES } from "./fleet-car";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const PDF_TYPES = new Set(["application/pdf"]);

function pdfSchema(requiredMessage: string) {
  return z.file({ error: requiredMessage }).superRefine((file, context) => {
    addFileValidationIssues({
      allowedTypes: PDF_TYPES,
      context,
      emptyMessage: "The selected file is empty",
      file,
      invalidTypeMessage: "Upload a PDF file",
      oversizedMessage: "PDF must not exceed 5 MB",
      path: [],
    });
  });
}

const policyNumberSchema = z
  .string({ error: "Insurance policy number is required" })
  .trim()
  .min(3, "Insurance policy number must be at least 3 characters")
  .max(100, "Insurance policy number must be at most 100 characters");

export const carOnboardingPlateFormSchema = z.object({
  plateNumber: z
    .string({ error: "Number plate is required" })
    .trim()
    .transform((value) => value.toUpperCase().replaceAll(/\s+/g, ""))
    .refine(
      (value) => /^[A-Z]{3}-?\d{3}[A-Z]{2}$/.test(value) || /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(value),
      "Enter a valid Nigerian number plate",
    )
    .transform((value) => value.replace("-", "")),
  policyNumber: policyNumberSchema,
});

export const carOnboardingDocumentsFormSchema = z.object({
  motCertificate: pdfSchema("MOT certificate is required"),
  insuranceCertificate: pdfSchema("Insurance certificate is required"),
});

function imageFiles(value: unknown) {
  if (value instanceof File) {
    return value.name === "" && value.size === 0 ? [] : [value];
  }
  if (Array.isArray(value)) {
    return value.filter(
      (file): file is File => file instanceof File && !(file.name === "" && file.size === 0),
    );
  }
  return [];
}

export const carOnboardingImagesFormSchema = z.object({
  images: z.preprocess(
    imageFiles,
    z
      .array(z.file())
      .min(MIN_FLEET_CAR_IMAGES, `Upload at least ${MIN_FLEET_CAR_IMAGES} images`)
      .max(5, "Upload up to 5 images")
      .superRefine((files, context) => {
        for (const file of files) {
          addFileValidationIssues({
            allowedTypes: IMAGE_TYPES,
            context,
            emptyMessage: "The selected image is empty",
            file,
            invalidTypeMessage: "Images must be JPEG, PNG, or WebP",
            oversizedMessage: "Image must not exceed 5 MB",
            path: [],
          });
        }
      }),
  ),
});

function checkboxValue(value: unknown) {
  return value === true || value === "true" || value === "on";
}

function nullableInteger(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  return value;
}

function blankToUndefined(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function requiredPositiveInt(label: string) {
  return z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: `${label} is required` })
      .int(`${label} must be a whole number`)
      .positive(`${label} must be greater than 0`),
  );
}

export const carOnboardingPricingFormSchema = z
  .object({
    hourlyRate: requiredPositiveInt("Hourly rate"),
    dayRate: requiredPositiveInt("Daily rate"),
    nightRate: requiredPositiveInt("Nightly rate"),
    fullDayRate: requiredPositiveInt("Full day rate"),
    airportPickupRate: requiredPositiveInt("Airport pickup rate"),
    fuelUpgradeRate: z.preprocess(
      nullableInteger,
      z.coerce
        .number({ error: "Fuel upgrade rate is required" })
        .int("Fuel upgrade rate must be a whole number")
        .positive("Fuel upgrade rate must be greater than 0")
        .nullable(),
    ),
    pricingIncludesFuel: z.preprocess(checkboxValue, z.boolean()),
    vehicleType: z.enum(["SEDAN", "SUV", "VAN", "CROSSOVER"], {
      error: "Select a vehicle type",
    }),
    serviceTier: z.enum(["STANDARD", "EXECUTIVE", "LUXURY", "ULTRA_LUXURY"], {
      error: "Select a service tier",
    }),
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
  policyNumber: policyNumberSchema,
});

export type CarOnboardingPricing = z.output<typeof carOnboardingPricingFormSchema>;

export type NewFleetCarActionData = {
  readonly error?: string;
  readonly revalidate?: false;
  readonly submission?: SubmissionResult<string[]>;
  readonly verification?: FleetVehicleVerification;
};

export type FleetCarOnboardingIntent =
  | "upload-documents"
  | "upload-images"
  | "save-pricing"
  | "verify-insurance";

export type FleetCarOnboardingActionData = {
  readonly error?: string;
  readonly intent?: FleetCarOnboardingIntent;
  readonly revalidate?: false;
  readonly submission?: SubmissionResult<string[]>;
};
