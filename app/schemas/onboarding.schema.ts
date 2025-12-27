import { z } from "zod";
import { banks } from "~/lib/banks";

const baseSchema = z.object({
  name: z
    .string({
      error: "Name is required.",
    })
    .min(1, "Name cannot be empty"),
  phoneNumber: z
    .string({
      error: "Phone number is required.",
    })
    .regex(
      /^\+234[789][01]\d{8}$/,
      "Phone number must be a valid Nigerian number (e.g., +2349012341234)",
    ),
  address: z
    .string({
      error: "Address is required.",
    })
    .min(1, "Address cannot be empty"),
  bankCode: z
    .string({
      error: "Bank is required.",
    })
    .refine((code) => banks.some((b) => b.code === code), {
      error: "Select a valid bank.",
    }),
  accountNumber: z
    .string({
      error: "Account number is required.",
    })
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  accountName: z
    .string({
      error: "Account name is required.",
    })
    .min(1, "Account name cannot be empty"),
});

export const ownerDriverSchema = baseSchema.extend({
  ownerDriver: z.literal("true"),
  // Validate based on the presence and size of the file, not instanceof File directly
  ninFile: z
    .any()
    .refine((file) => file && file.size > 0, "NIN is required")
    .refine((file) => !file || file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine(
      (file) =>
        !file || ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type),
      "File must be a JPEG, PNG, WebP or PDF",
    ),
  driversLicense: z
    .any()
    .refine((file) => file && file.size > 0, "Driver's license is required")
    .refine((file) => !file || file.size <= 5 * 1024 * 1024, "File must be less than 5MB")
    .refine(
      (file) =>
        !file || ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type),
      "File must be a JPEG, PNG, WebP or PDF",
    ),
  lasdriCard: z
    .any()
    .optional()
    .refine(
      (file) => !file || file.size === 0 || file.size <= 5 * 1024 * 1024,
      "File must be less than 5MB",
    )
    .refine(
      (file) =>
        !file ||
        file.size === 0 ||
        ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type),
      "File must be a JPEG, PNG, WebP or PDF",
    ),
});

const fleetOwnerSchema = baseSchema.extend({
  ownerDriver: z.literal("false"),
});

export const onboardingSchema = z.discriminatedUnion("ownerDriver", [
  fleetOwnerSchema,
  ownerDriverSchema,
]);
