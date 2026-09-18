import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";
import { referralIncentiveTypeSchema } from "~/api/admin/referrals/schema";
import { BOOKING_TYPE_OPTIONS } from "~/booking/types";

const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalMoneySchema = z.preprocess(
  blankToUndefined,
  z.coerce
    .number({ error: "Enter a valid amount" })
    .positive("Amount must be greater than zero")
    .max(99_999_999.99, "Amount is too large")
    .multipleOf(0.01, "Use no more than two decimal places")
    .optional(),
);
const optionalPercentageSchema = z.preprocess(
  blankToUndefined,
  z.coerce
    .number({ error: "Enter a valid percentage" })
    .positive("Percentage must be greater than zero")
    .max(100, "Percentage cannot exceed 100")
    .multipleOf(0.01, "Use no more than two decimal places")
    .optional(),
);
const creditCapSchema = z.coerce
  .number({ error: "Enter a valid value" })
  .min(0, "Value cannot be negative")
  .max(99_999_999.99, "Value is too large")
  .multipleOf(0.01, "Use no more than two decimal places");

const referralProgramFieldsSchema = z.object({
  refereeDiscountType: referralIncentiveTypeSchema,
  refereeDiscountAmount: optionalMoneySchema,
  refereeDiscountPercentage: optionalPercentageSchema,
  refereeDiscountMaxAmount: optionalMoneySchema,
  referrerRewardType: referralIncentiveTypeSchema,
  referrerRewardAmount: optionalMoneySchema,
  referrerRewardPercentage: optionalPercentageSchema,
  referrerRewardMaxAmount: optionalMoneySchema,
  minimumBookingAmount: z.coerce
    .number({ error: "Enter a valid amount" })
    .positive("Minimum booking amount must be greater than zero")
    .max(99_999_999.99, "Amount is too large")
    .multipleOf(0.01, "Use no more than two decimal places"),
  eligibleBookingTypes: z
    .array(z.enum(BOOKING_TYPE_OPTIONS))
    .min(1, "Select at least one booking type")
    .refine((values) => new Set(values).size === values.length, "Booking types must be unique"),
  referralValidityDays: z.coerce
    .number({ error: "Enter a valid number of days" })
    .int("Use a whole number of days")
    .min(0, "Days cannot be negative")
    .max(3650, "Days cannot exceed 3650"),
  maxCreditsPerBookingAmount: creditCapSchema,
  maxCreditsPerBookingPercent: creditCapSchema.max(100, "Percentage cannot exceed 100"),
});

function requireValue(
  value: number | undefined,
  path: keyof z.input<typeof referralProgramFieldsSchema>,
  ctx: z.RefinementCtx,
) {
  if (value === undefined) {
    ctx.addIssue({ code: "custom", message: "This value is required", path: [path] });
  }
}

export const referralProgramFormSchema = referralProgramFieldsSchema
  .superRefine((value, ctx) => {
    if (value.refereeDiscountType === "FIXED") {
      requireValue(value.refereeDiscountAmount, "refereeDiscountAmount", ctx);
    } else {
      requireValue(value.refereeDiscountPercentage, "refereeDiscountPercentage", ctx);
      requireValue(value.refereeDiscountMaxAmount, "refereeDiscountMaxAmount", ctx);
    }

    if (value.referrerRewardType === "FIXED") {
      requireValue(value.referrerRewardAmount, "referrerRewardAmount", ctx);
    } else {
      requireValue(value.referrerRewardPercentage, "referrerRewardPercentage", ctx);
      requireValue(value.referrerRewardMaxAmount, "referrerRewardMaxAmount", ctx);
    }
  })
  .transform((value) => ({
    refereeDiscount:
      value.refereeDiscountType === "FIXED"
        ? { type: "FIXED" as const, amount: value.refereeDiscountAmount as number }
        : {
            type: "PERCENTAGE" as const,
            percentage: value.refereeDiscountPercentage as number,
            maxAmount: value.refereeDiscountMaxAmount as number,
          },
    referrerReward:
      value.referrerRewardType === "FIXED"
        ? { type: "FIXED" as const, amount: value.referrerRewardAmount as number }
        : {
            type: "PERCENTAGE" as const,
            percentage: value.referrerRewardPercentage as number,
            maxAmount: value.referrerRewardMaxAmount as number,
          },
    minimumBookingAmount: value.minimumBookingAmount,
    eligibleBookingTypes: value.eligibleBookingTypes,
    referralValidityDays: value.referralValidityDays,
    maxCreditsPerBookingAmount: value.maxCreditsPerBookingAmount,
    maxCreditsPerBookingPercent: value.maxCreditsPerBookingPercent,
  }));

export type ReferralProgramActionData = {
  readonly intent: "create" | "update" | "status";
  readonly error?: string;
  readonly revalidate?: boolean;
  readonly success?: string;
  readonly submission?: SubmissionResult<string[]>;
};
