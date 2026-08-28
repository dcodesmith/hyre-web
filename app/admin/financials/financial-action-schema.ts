import { z } from "zod";

const optionalProviderIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const reconcileRefundFormSchema = z.object({
  intent: z.literal("reconcile-refund"),
  refundProviderId: optionalProviderIdSchema,
});

export const reconcilePayoutFormSchema = z.object({
  intent: z.literal("reconcile-payout"),
});

export type FinancialActionData = {
  readonly error?: string;
  readonly success?: string;
};
