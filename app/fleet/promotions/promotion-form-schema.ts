import type { SubmissionResult } from "@conform-to/react";
import { z } from "zod";

export const MAX_PROMOTION_PERCENTAGE = 50;

const optionalPromotionNameSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const createPromotionFormSchema = z
  .object({
    name: optionalPromotionNameSchema,
    target: z.union([z.literal("FLEET"), z.cuid()]),
    discountValue: z.coerce
      .number({ error: "Discount percentage is required" })
      .min(1, "Discount must be at least 1%")
      .max(MAX_PROMOTION_PERCENTAGE, `Discount cannot exceed ${MAX_PROMOTION_PERCENTAGE}%`),
    startDate: z.iso.date({ error: "Start date is required" }),
    endDate: z.iso.date({ error: "End date is required" }),
  })
  .refine(({ startDate, endDate }) => endDate >= startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const deactivatePromotionFormSchema = z.object({
  promotionId: z.cuid(),
});

export type PromotionActionData = {
  readonly intent: "create" | "deactivate";
  readonly error?: string;
  readonly revalidate?: false;
  readonly submission?: SubmissionResult<string[]>;
};
