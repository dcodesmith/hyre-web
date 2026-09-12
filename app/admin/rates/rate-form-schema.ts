import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";

import { platformFeeTypeSchema } from "~/api/admin/rates/schema";

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

const optionalDescriptionSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500, "Description must be 500 characters or fewer").optional(),
);

const effectiveWindowSchema = z.object({
  effectiveSince: localDateTimeSchema,
  effectiveUntil: optionalLocalDateTimeSchema,
  description: optionalDescriptionSchema,
});

function endFollowsStart({
  effectiveSince,
  effectiveUntil,
}: {
  effectiveSince: string;
  effectiveUntil?: string;
}) {
  return !effectiveUntil || effectiveUntil > effectiveSince;
}

const requiredRatePercentSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce
    .number({ error: "Rate percentage is required" })
    .min(0, "Rate cannot be negative")
    .max(100, "Rate cannot exceed 100%"),
);

export const platformFeeFormSchema = effectiveWindowSchema
  .extend({
    feeType: platformFeeTypeSchema,
    ratePercent: requiredRatePercentSchema,
  })
  .refine(endFollowsStart, {
    message: "End date must be after the start date",
    path: ["effectiveUntil"],
  });

export const vatRateFormSchema = effectiveWindowSchema
  .extend({
    ratePercent: requiredRatePercentSchema,
  })
  .refine(endFollowsStart, {
    message: "End date must be after the start date",
    path: ["effectiveUntil"],
  });

export function toUtcIso(localDateTime: string) {
  return `${localDateTime}:00.000Z`;
}

export type RateActionData = {
  readonly intent: "platform-fee" | "vat";
  readonly error?: string;
  readonly revalidate?: boolean;
  readonly success?: string;
  readonly submission?: SubmissionResult<string[]>;
};
