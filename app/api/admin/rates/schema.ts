import { z } from "zod";

export const platformFeeTypeSchema = z.enum(["PLATFORM_SERVICE_FEE", "FLEET_OWNER_COMMISSION"]);
export const addonTypeSchema = z.literal("SECURITY_DETAIL");

const rateWindowSchema = z.object({
  id: z.string(),
  effectiveSince: z.iso.datetime(),
  effectiveUntil: z.iso.datetime().nullable(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const platformFeeRateMutationSchema = rateWindowSchema.extend({
  feeType: platformFeeTypeSchema,
  ratePercent: z.number().min(0).max(100),
});

const vatRateMutationSchema = rateWindowSchema.extend({
  ratePercent: z.number().min(0).max(100),
});

const addonRateMutationSchema = rateWindowSchema.extend({
  addonType: addonTypeSchema,
  rateAmount: z.number().min(0),
});

export const adminRatesSchema = z.object({
  platformFeeRates: z.array(platformFeeRateMutationSchema.extend({ active: z.boolean() })),
  taxRates: z.array(vatRateMutationSchema.extend({ active: z.boolean() })),
  addonRates: z.array(addonRateMutationSchema.extend({ active: z.boolean() })),
});

export { addonRateMutationSchema, platformFeeRateMutationSchema, vatRateMutationSchema };

export type AdminRates = z.output<typeof adminRatesSchema>;
export type AddonRate = AdminRates["addonRates"][number];
export type PlatformFeeRate = AdminRates["platformFeeRates"][number];
export type VatRate = AdminRates["taxRates"][number];
