import { z } from "zod";
import { FleetOwnerStatus, CarApprovalStatus, AddonType } from "@prisma/client";

const PLATFORM_FEE_TYPES = ["PLATFORM_SERVICE_FEE", "FLEET_OWNER_COMMISSION"] as const;

// Shared field definitions
const emailField = z.email("Email address is not valid.");

const descriptionField = z
  .string({
    error: "Description is required.",
  })
  .optional();

const ratePercentField = z
  .string({
    error: "Rate percentage is required and must be a string.",
  })
  .min(1, "Rate percentage cannot be empty")
  .transform((val) => Number.parseFloat(val))
  .refine((val) => val >= 0 && val <= 100, "Rate must be between 0 and 100%");

const effectiveSinceField = z
  .string({
    error: "Effective date is required and must be a string.",
  })
  .min(1, "Effective date cannot be empty")
  .transform((val) => new Date(val))
  .refine((date) => !Number.isNaN(date.getTime()), "Invalid effective date");

const effectiveUntilField = z
  .string()
  .optional()
  .transform((val) => (val ? new Date(val) : null))
  .refine((date) => !date || !Number.isNaN(date.getTime()), "Invalid end date");

const dateRangeValidation = (data: { effectiveUntil: Date | null; effectiveSince: Date }) => {
  if (data.effectiveUntil && data.effectiveSince) {
    return data.effectiveUntil > data.effectiveSince;
  }
  return true;
};

export const staffSchema = z.object({
  name: z
    .string({
      error: "Name is required and must be a string.",
    })
    .min(2, "Name must be at least 2 characters"),
  email: emailField,
  phoneNumber: z
    .string({
      error: "Phone number is required and must be a string.",
    })
    .min(10, "Phone number must be at least 10 digits"),
});

export const ManualAttributionSchema = z.object({
  refereeEmail: emailField,
  referrerEmail: emailField,
  reason: z
    .string({
      error: "Reason is required and must be a string.",
    })
    .min(1, "Reason cannot be empty"),
});

export const ConfigSchema = z.object({
  REFERRAL_ENABLED: z.coerce.boolean().default(false),
  REFERRAL_DISCOUNT_AMOUNT: z.coerce.number().pipe(z.int().min(0)).default(0),
  REFERRAL_MIN_BOOKING_AMOUNT: z.coerce.number().pipe(z.int().min(0)).default(0),
  REFERRAL_ELIGIBLE_TYPES: z.array(z.enum(["DAY", "NIGHT", "FULL_DAY"])).default([]),
  REFERRAL_RELEASE_CONDITION: z.enum(["PAID", "COMPLETED"]).default("COMPLETED"),
  REFERRAL_EXPIRY_DAYS: z.coerce.number().pipe(z.int().min(0)).default(0),
});

export const UpdateOwnerStatusSchema = z.object({
  ownerId: z
    .string({
      error: "Owner ID is required and must be a string.",
    })
    .min(1, "Owner ID cannot be empty"),
  status: z.enum(FleetOwnerStatus, {
    error: "Status is required and must be valid.",
  }),
  intent: z.literal("updateOwnerStatus", {
    error: "Intent is required and must be valid.",
  }),
});

export const updateCarStatusSchema = z.object({
  intent: z.literal("updateCarStatus"),
  carId: z
    .string({
      error: "Car ID is required and must be a string.",
    })
    .min(1, "Car ID cannot be empty"),
  status: z.enum(CarApprovalStatus, {
    error: "Car approval status is required and must be valid.",
  }),
});

export const updateOwnerStatusSchema = z.object({
  intent: z.literal("updateOwnerStatus"),
  status: z.enum(FleetOwnerStatus, {
    error: "Fleet owner status is required and must be valid.",
  }),
});

export const createAddonRateSchema = z.object({
  addonType: z.enum(AddonType, {
    error: "Addon type is required and must be valid.",
  }),
  rateAmount: z.coerce
    .number({
      error: "Rate amount is required and must be a number.",
    })
    .pipe(z.int().positive("Rate amount must be a positive number")),
  description: descriptionField,
  effectiveSince: z.coerce.date({
    error: "Effective date is required and must be a valid date.",
  }),
});

export const vatRateSchema = z
  .object({
    ratePercent: ratePercentField,
    effectiveSince: effectiveSinceField,
    effectiveUntil: effectiveUntilField,
    description: descriptionField,
  })
  .refine(dateRangeValidation, {
    error: "End date must be after start date",
    path: ["effectiveUntil"],
  });

export const platformFeeSchema = z
  .object({
    feeType: z.enum(PLATFORM_FEE_TYPES, {
      error: "Fee type is required and must be valid.",
    }),
    ratePercent: ratePercentField,
    effectiveSince: effectiveSinceField,
    effectiveUntil: effectiveUntilField,
    description: descriptionField,
  })
  .refine(dateRangeValidation, {
    error: "End date must be after start date",
    path: ["effectiveUntil"],
  });

export const EligibilitySchema = z.object({
  amount: z.coerce
    .number({
      error: "Amount is required and must be a number.",
    })
    .pipe(z.int().min(1, "Amount must be greater than 0")),
  type: z.enum(["DAY", "NIGHT", "FULL_DAY"], {
    error: "Booking type is required and must be valid.",
  }),
});
