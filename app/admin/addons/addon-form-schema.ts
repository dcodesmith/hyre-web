import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";
import { addonPricingUnitSchema } from "~/api/addons/schema";
import { addonFinancialTreatmentSchema } from "~/api/admin/addons/schema";
import { BOOKING_TYPE_OPTIONS } from "~/booking/types";

const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const localDateTimeSchema = z
  .string({ error: "Effective date and time are required" })
  .regex(LOCAL_DATE_TIME_PATTERN, "Enter a valid date and time")
  .refine((value) => {
    const date = new Date(`${value}:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString() === `${value}:00.000Z`;
  }, "Enter a valid date and time");

const optionalLocalDateTimeSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  localDateTimeSchema.optional(),
);

const descriptionSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500).optional(),
);

const bookingTypesSchema = z
  .array(z.enum(BOOKING_TYPE_OPTIONS))
  .min(1, "Select at least one booking type")
  .refine((values) => new Set(values).size === values.length, "Booking types must be unique");

const addonFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: descriptionSchema,
  bookingTypes: bookingTypesSchema,
});

export const createAddonFormSchema = addonFieldsSchema.extend({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(64)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Use UPPER_SNAKE_CASE"),
  pricingUnit: addonPricingUnitSchema,
  financialTreatment: addonFinancialTreatmentSchema,
});

export const updateAddonFormSchema = addonFieldsSchema.extend({
  addonId: z.string().cuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const createAddonPriceFormSchema = z
  .object({
    addonId: z.string().cuid(),
    amount: z.coerce
      .number({ error: "Amount is required" })
      .positive("Amount must be positive")
      .max(99_999_999.99, "Amount is too large")
      .multipleOf(0.01, "Use no more than two decimal places"),
    effectiveSince: localDateTimeSchema,
    effectiveUntil: optionalLocalDateTimeSchema,
  })
  .refine(
    ({ effectiveSince, effectiveUntil }) => !effectiveUntil || effectiveUntil > effectiveSince,
    {
      message: "End date must be after the start date",
      path: ["effectiveUntil"],
    },
  );

export const endAddonPriceFormSchema = z.object({
  addonId: z.string().cuid(),
  priceId: z.string().cuid(),
});

export function toUtcIso(localDateTime: string) {
  return `${localDateTime}:00.000Z`;
}

export type AddonActionData = {
  readonly intent: "create-addon" | "update-addon" | "create-price" | "end-price";
  readonly error?: string;
  readonly revalidate?: boolean;
  readonly success?: string;
  readonly submission?: SubmissionResult<string[]>;
};
